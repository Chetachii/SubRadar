# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with CRXJS hot reload
npm run build     # Build extension to dist/
npm run lint      # ESLint over src/
npm run format    # Prettier over src/
```

After `npm run build`, load the `dist/` folder as an unpacked extension at `chrome://extensions` (Developer Mode on).

## Architecture

SubRadar is a Chrome Extension (Manifest V3) built with React + TypeScript + Vite. The build is driven by `@crxjs/vite-plugin`, which reads `manifest.json` as the entry config and automatically handles chunking for each extension context.

### Runtime contexts

There are four isolated runtimes that cannot share memory:

| Context | Entry | Notes |
|---|---|---|
| Background service worker | `src/background/index.ts` | Registers alarms, message router, notification handlers |
| Content script | `src/content/index.ts` | Injected into every page; runs detection, sends messages to background |
| Popup | `src/popup/main.tsx` → `index.html` | React UI; communicates via `chrome.runtime.sendMessage` |
| Dashboard | `src/dashboard/main.tsx` → `dashboard.html` | React UI; reads storage directly via repository layer |

### Communication model

- **Content script → Background:** sends `DETECTION_FOUND` with a `DetectionResult` payload, which background stores in `chrome.storage.session` as `pendingDetection`
- **Popup/Dashboard → Background:** all mutations go through `chrome.runtime.sendMessage` with typed message types (`SAVE_SUBSCRIPTION`, `UPDATE_SUBSCRIPTION`, `SNOOZE_SUBSCRIPTION`, `MARK_RENEWED`)
- **Background → UI:** via `chrome.notifications` with button actions handled in `background/notifications.ts`
- **Dashboard reads storage directly** via `src/repository/subscriptionRepository.ts` — no message hop needed for reads

### Data flow

```
Page visit
  → content/classifier.ts     (score URL + DOM signals, threshold = 5)
  → content/extractor.ts      (pull serviceName, price, billingFrequency, trialDuration)
  → content/detector.ts       (orchestrate, emit DetectionResult)
  → background/messageRouter  (store pendingDetection in session storage)
  → popup/Popup.tsx           (reads pendingDetection, shows TrackPrompt or ManualEntryForm)
  → background/messageRouter  (SAVE_SUBSCRIPTION → subscriptionService → subscriptionRepository)
  → chrome.storage.local      (source of truth)

Daily alarm
  → background/alarms.ts      (chrome.alarms fires DAILY_REMINDER_SCAN every 1440 min)
  → background/notifications  (scanDueReminders → dispatchReminderNotification per eligible sub)
```

### Layer responsibilities

- **`src/types/`** — shared TypeScript interfaces (`Subscription`, `DetectionResult`, `ReminderEvent`, `Preferences`). Import from here, never redefine types elsewhere.
- **`src/repository/`** — only layer that touches `chrome.storage.local`. All reads/writes go here. Abstract enough to swap for Supabase later.
- **`src/services/`** — business logic only, no storage access. Takes repository results as inputs.
  - `reminderService`: due date resolution, reminder eligibility scan
  - `statusService`: derives `cancel_soon`/`renew_soon`/`active` from intent + due date proximity (7-day urgency window)
  - `subscriptionService`: create/update/archive/cancel/markRenewed workflows
  - `duplicateService`: match by normalized service name + sourceDomain
- **`src/background/`** — wires Chrome APIs to services. `messageRouter.ts` is the single dispatch point for all incoming messages.
- **`src/content/`** — page analysis only, no storage. `promptState.ts` uses an in-memory Map to suppress duplicate prompts per URL within a page session.

### Key business rules

- Reminder date = `renewalDate` (or fallback `trialEndDate`) minus `reminderLeadDays` (default 3)
- `cancel_soon` status: due within 7 days AND intent is `cancel_before_trial_ends`
- `renew_soon` status: due within 7 days AND intent is `remind_before_billing` or `renew_automatically`
- A notification fires only if: active sub, reminder date reached, not snoozed, not already sent today
- Daily scan uses one repeating alarm (not per-subscription alarms) — scan logic must be idempotent
