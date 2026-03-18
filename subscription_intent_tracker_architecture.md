# Subscription Intent Tracker
## Application Architecture and System Design

## 1. Architecture Overview

Subscription Intent Tracker is a Chrome extension-based product designed to detect subscription events during browsing, capture user intent, store subscription metadata, and notify the user before renewal.

The MVP architecture is intentionally lean. It is built around the Chrome Extension platform, local-first storage, and a lightweight reminder engine. The design must support future expansion to cloud sync and smarter detection without requiring a full rebuild.

### Architecture goals
- Keep MVP simple enough to build quickly
- Ensure reminders work reliably within Chrome Extension constraints
- Support both auto-detection and manual entry
- Preserve user privacy by default
- Make systems modular so detection, storage, and reminders can evolve independently

---

## 2. High-Level System Architecture

The application consists of seven core systems:

1. **Extension Shell System**
2. **Subscription Detection System**
3. **Intent Capture and Tracking System**
4. **Subscription Data Management System**
5. **Reminder and Notification System**
6. **Dashboard and Management System**
7. **Settings and Preferences System**

These systems run within the Chrome Extension runtime and communicate through Chrome APIs, shared data models, and extension messaging.

### High-level flow
1. User browses to a relevant page.
2. Content script evaluates the page.
3. Detection engine determines whether the page likely represents a trial or subscription moment.
4. Extension prompts user to track it.
5. User selects intent and confirms details.
6. Data is stored in local extension storage.
7. Reminder engine scans saved records daily.
8. Notification system alerts user when action is needed.
9. Dashboard provides a management interface for all tracked subscriptions.

---

## 3. Runtime Architecture

### 3.1 Chrome Extension Runtime Components

The MVP is composed of these runtime parts:

- **Content Script**
- **Background Service Worker**
- **Popup UI**
- **Dashboard / Options Page**
- **Shared Storage Layer**

Each runtime part has a specific responsibility.

### Content Script
Injected into visited pages to analyze the DOM and identify subscription signals.

### Background Service Worker
Coordinates reminders, handles alarms, dispatches notifications, and manages global extension behaviors.

### Popup UI
The lightweight entry point that appears when the user clicks the extension icon or when a trackable event is detected.

### Dashboard / Options Page
The main management interface where all tracked subscriptions are listed and managed.

### Shared Storage Layer
Stores subscription records, reminder metadata, snooze data, and user preferences.

---

## 4. Core Systems Definition

## 4.1 Extension Shell System

### Purpose
The Extension Shell System provides the base runtime environment for the app. It defines the manifest, permissions, entry points, and communication boundaries.

### Responsibilities
- Register extension permissions
- Load the background service worker
- Inject content scripts into supported pages
- Expose popup UI
- Expose dashboard page
- Handle extension lifecycle events

### Main components
- `manifest.json`
- background bootstrap
- popup bootstrap
- dashboard bootstrap
- message routing helpers

### Inputs
- browser events
- page loads
- user clicks on extension icon
- scheduled alarms

### Outputs
- initialized extension state
- injected page detection logic
- UI entry points
- routed messages between systems

### Design considerations
- Must use Manifest V3
- Must keep permissions minimal while supporting page detection and notifications
- Must clearly separate page analysis from data storage logic

---

## 4.2 Subscription Detection System

### Purpose
The Subscription Detection System identifies likely subscription-related moments while the user is browsing.

### Responsibilities
- inspect active web pages
- detect pricing, billing, trial, and checkout contexts
- extract probable subscription details
- compute detection confidence
- trigger tracking prompts
- avoid duplicate prompting on the same page session

### Subsystems
1. **Page Classifier**
2. **Signal Extractor**
3. **Confidence Scoring Engine**
4. **Prompt Trigger Controller**

### 4.2.1 Page Classifier
Determines whether the current page is likely relevant.

#### Detection inputs
- current URL
- page title
- visible headings
- CTA labels
- page text content
- known provider markers (e.g. Stripe)

#### Example patterns
- `/pricing`
- `/checkout`
- `/plans`
- `/billing`
- phrases such as `start free trial`, `billed annually`, `subscribe now`

### 4.2.2 Signal Extractor
Attempts to pull subscription metadata from the page.

#### Extractable fields
- service name
- price
- billing frequency
- trial duration
- probable renewal date if textual signals exist
- source domain

### 4.2.3 Confidence Scoring Engine
Assigns weighted points to detected signals.

#### Example scoring model
- relevant URL pattern: +2
- trial language found: +3
- pricing block found: +2
- subscription CTA found: +3
- checkout provider found: +3

If threshold is met, system produces a detection result.

### 4.2.4 Prompt Trigger Controller
Decides whether to show the prompt.

#### Responsibilities
- suppress repeated prompts on same page
- prevent prompts if user has dismissed recently
- send detection event to popup or background layer

### Detection output contract
```ts
interface DetectionResult {
  pageUrl: string;
  sourceDomain: string;
  confidenceScore: number;
  serviceName?: string;
  price?: number;
  currency?: string;
  billingFrequency?: string;
  trialDurationDays?: number;
  detectedRenewalDate?: string;
  matchedSignals: string[];
}
```

### Failure handling
If extraction is incomplete, the system should still allow user confirmation and manual editing.

---

## 4.3 Intent Capture and Tracking System

### Purpose
This system translates a detected or manually entered subscription into a structured record with user intent.

### Responsibilities
- present subscription review form
- allow manual entry if auto-detection fails
- capture user intent
- validate required fields
- create normalized subscription records

### Subsystems
1. **Track Prompt UI**
2. **Manual Entry Form**
3. **Intent Selector**
4. **Validation and Normalization Layer**

### 4.3.1 Track Prompt UI
Appears after a detection event.

#### Responsibilities
- display pre-filled subscription details
- allow user to confirm or edit
- collect intent selection
- save or dismiss

### 4.3.2 Manual Entry Form
Supports fallback tracking.

#### Required input
- service name
- user intent

#### Optional input
- price
- billing frequency
- subscribed date
- trial end date
- renewal date
- cancellation URL
- notes

### 4.3.3 Intent Selector
Defines the behavioral meaning of a subscription.

#### Supported intent values
- `renew_automatically`
- `remind_before_billing`
- `cancel_before_trial_ends`
- `undecided`

### 4.3.4 Validation and Normalization Layer
Ensures stored data is consistent.

#### Responsibilities
- trim and normalize service names
- validate dates
- validate cost values
- compute default status
- derive reminder date if possible
- assign generated ID
- apply timestamps

---

## 4.4 Subscription Data Management System

### Purpose
The Subscription Data Management System is the source of truth for tracked subscriptions and their lifecycle state.

### Responsibilities
- store and retrieve subscriptions
- update status transitions
- support editing
- support archiving and cancellation
- enforce duplicate handling rules
- expose filtered views for dashboard and reminder engine

### Data storage strategy
For MVP, use `chrome.storage.local`.

### Future-ready migration path
Abstract all storage operations behind a repository layer so future migration to Supabase is straightforward.

### Key repository functions
- `createSubscription()`
- `updateSubscription()`
- `getSubscriptionById()`
- `listSubscriptions()`
- `archiveSubscription()`
- `cancelSubscription()`
- `markRenewed()`
- `setSnooze()`

### Duplicate handling
If an active subscription exists with the same service name and source domain, the system should flag a possible duplicate.

#### Duplicate actions
- update existing
- keep both
- dismiss new entry

### Entity model
```ts
interface Subscription {
  id: string;
  serviceName: string;
  sourceDomain?: string;
  subscriptionDate?: string;
  trialEndDate?: string;
  renewalDate?: string;
  reminderDate?: string;
  cost?: number;
  currency?: string;
  billingFrequency?: "one_time" | "weekly" | "monthly" | "quarterly" | "yearly" | "unknown";
  cancellationUrl?: string;
  intent: "renew_automatically" | "remind_before_billing" | "cancel_before_trial_ends" | "undecided";
  status: "active" | "cancel_soon" | "renew_soon" | "archived" | "canceled";
  notes?: string;
  detectionSource: "auto_detected" | "manual_entry";
  createdAt: string;
  updatedAt: string;
  snoozedUntil?: string;
  lastReminderSentAt?: string;
}
```

### Derived status logic
- `cancel_soon`: due soon and user selected cancel intent
- `renew_soon`: due soon and user selected renew/remind intent
- `active`: active but not urgent
- `archived`: hidden from default management view
- `canceled`: explicitly canceled

---

## 4.5 Reminder and Notification System

### Purpose
The Reminder and Notification System ensures users are alerted before renewal or trial conversion.

### Responsibilities
- determine which records need reminders
- scan tracked subscriptions regularly
- generate due reminder events
- dispatch browser notifications
- handle reminder actions
- persist reminder state and snooze behavior

### Reminder strategy
For MVP, use a **daily scan model** rather than one alarm per subscription.

### Why daily scan is better
- simpler under Manifest V3 constraints
- easier to maintain
- reliable for modest subscription counts
- avoids managing many alarm registrations

### Subsystems
1. **Reminder Scheduler**
2. **Due Date Resolver**
3. **Reminder Evaluator**
4. **Notification Dispatcher**
5. **Reminder Action Handler**

### 4.5.1 Reminder Scheduler
Creates a repeating daily alarm using `chrome.alarms`.

#### Behavior
- schedule one recurring alarm every 24 hours
- optionally run a check at extension startup

### 4.5.2 Due Date Resolver
Determines the effective due date.

#### Rule order
1. use `renewalDate` if present
2. else use `trialEndDate` if present
3. else subscription has no reminder target

### 4.5.3 Reminder Evaluator
Determines if a reminder should fire.

#### Conditions
- subscription is not archived or canceled
- reminder date is today or overdue
- reminder has not already been sent for this cycle
- snoozedUntil is not in the future

### 4.5.4 Notification Dispatcher
Sends Chrome notifications with action buttons.

#### Notification actions
- open cancellation page
- snooze for 24 hours
- mark renewed

### 4.5.5 Reminder Action Handler
Processes interactions from notification clicks.

#### Action outcomes
- open cancellation URL in new tab
- update snoozedUntil
- update status and renewal metadata when marked renewed

### Reminder event model
```ts
interface ReminderEvent {
  subscriptionId: string;
  dueDate: string;
  reminderDate: string;
  type: "renewal_warning" | "trial_end_warning";
  deliveredAt?: string;
  status: "pending" | "sent" | "snoozed" | "completed";
}
```

---

## 4.6 Dashboard and Management System

### Purpose
Provides a full management interface for tracked subscriptions.

### Responsibilities
- display all subscriptions in meaningful sections
- allow editing and status changes
- expose cancellation links
- show urgency clearly
- provide archive and filtering controls

### Dashboard information architecture
Primary sections:
- Cancel soon
- Renew soon
- Active recurring
- Archived

### Subsystems
1. **Subscription List Renderer**
2. **Section Grouper**
3. **Filter and Sort Controller**
4. **Subscription Editor**
5. **Action Controls**

### 4.6.1 Subscription List Renderer
Renders cards or rows for each tracked subscription.

### 4.6.2 Section Grouper
Groups records by derived status and urgency.

### 4.6.3 Filter and Sort Controller
Optional MVP filters:
- all
- active
- cancel soon
- archived

Sort strategies:
- nearest renewal date first
- newest tracked first
- alphabetical by service name

### 4.6.4 Subscription Editor
Allows inline or modal editing of:
- service name
- dates
- pricing
- intent
- cancellation URL
- notes

### 4.6.5 Action Controls
Available actions:
- archive
- mark canceled
- mark renewed
- open cancellation page
- snooze reminder

### Empty-state design
Each section should provide empty-state messaging to reduce dashboard dead ends.

---

## 4.7 Settings and Preferences System

### Purpose
Stores user preferences that influence reminders and extension behavior.

### Responsibilities
- manage notification preferences
- store detection prompt preferences
- store reminder lead time
- store dismissal cooldowns

### MVP settings
- browser notifications enabled/disabled
- reminder lead time in days (default 3)
- suppress repeated prompt duration
- dashboard default sort preference

### Future settings
- email reminders
- cloud sync preference
- theme preference
- detection sensitivity level

---

## 5. Cross-System Communication Model

### Communication approach
Chrome extension systems communicate through:
- runtime messaging
- shared storage reads/writes
- background event listeners

### Message pathways
- Content script → background: detection event
- Popup → background: save/update actions
- Dashboard → storage/repository: read and update actions
- Background → notification system: due reminder dispatch
- Notification click → background: action processing

### Message examples
- `DETECTION_FOUND`
- `SAVE_SUBSCRIPTION`
- `UPDATE_SUBSCRIPTION`
- `RUN_REMINDER_SCAN`
- `SNOOZE_SUBSCRIPTION`
- `MARK_RENEWED`

### Design principle
UI systems should not directly own business logic. Business rules should live in shared services or background-managed modules.

---

## 6. Data Architecture

## 6.1 Primary Data Domains

### Subscription domain
Stores all tracked subscriptions.

### Reminder domain
Stores reminder state, snoozes, and notification history.

### Preferences domain
Stores user-specific extension settings.

## 6.2 Storage layout suggestion
```ts
{
  subscriptions: Subscription[];
  preferences: {
    notificationsEnabled: boolean;
    reminderLeadDays: number;
    promptCooldownHours: number;
    defaultSort: string;
  };
  runtimeMeta: {
    lastReminderScanAt?: string;
    dismissedPages?: Record<string, string>;
  };
}
```

## 6.3 Data lifecycle
1. record created from detection or manual entry
2. record updated over time
3. reminder status changes as notifications fire
4. record may be canceled or archived
5. archived records remain retrievable for history

---

## 7. Business Logic Rules

## 7.1 Reminder date computation
- reminder date = due date minus reminderLeadDays
- due date = renewalDate or fallback trialEndDate

## 7.2 Status derivation
- if archived, section = Archived
- if canceled, do not remind
- if due within urgency window and intent is cancel_before_trial_ends, section = Cancel soon
- if due within urgency window and intent is renew/remind, section = Renew soon
- else section = Active recurring

## 7.3 Notification eligibility
A notification may be sent only if:
- subscription has valid due date
- subscription is active
- reminder date is reached
- no reminder already delivered for current cycle
- notifications are enabled

## 7.4 Prompt suppression rules
The extension should not repeatedly prompt the user on the same page/session unless:
- page changed significantly
- dismissal cooldown has expired
- the user manually requests tracking

---

## 8. Detailed Technical Stack

### Core platform
- Chrome Extension (Manifest V3)

### Frontend
- React
- TypeScript
- CSS or Tailwind CSS

### Build tooling
- Vite
- ESLint
- Prettier

### Browser APIs
- `chrome.storage.local`
- `chrome.notifications`
- `chrome.alarms`
- `chrome.tabs`
- `chrome.runtime`
- `chrome.scripting`

### Date handling
- lightweight date utility library or native date helpers

### Future-ready backend
- Supabase for auth, sync, and cloud persistence

---

## 9. Security and Privacy Architecture

### Privacy model
The MVP should operate local-first.

### Principles
- do not collect payment credentials
- do not persist unnecessary page content
- do not transmit browsing data externally
- store only relevant subscription metadata

### Sensitive data exclusions
Do not capture:
- card numbers
- billing addresses
- account passwords
- full checkout forms

### Permission trust strategy
Because `<all_urls>` may be needed for detection, onboarding must clearly explain why page access exists and how data is used.

---

## 10. Reliability and Failure Strategy

### Detection failures
If detection confidence is low or extraction fails, user can still manually add a subscription.

### Notification failures
If browser notifications are disabled, dashboard must still surface upcoming renewals.

### Storage resilience
All write operations should:
- validate input first
- fail safely
- avoid corrupting storage shape

### Manifest V3 limitation handling
Since service workers are not persistent:
- reminder scan must be idempotent
- runtime initialization must be lightweight
- state should not depend on memory only

---

## 11. Scalability and Evolution Path

### MVP scale assumptions
- single-user only
- local-only storage
- under 500 saved subscriptions

### Version 2 evolution path
- add Supabase sync
- add authentication
- support multi-device persistence
- support AI-assisted extraction
- add smarter domain-specific detection packs

### Architectural preparation
Abstract these layers from day one:
- storage repository
- reminder logic
- detection engine interfaces
- shared data types

This prevents lock-in to local-only MVP implementation.

---

## 12. Detailed Module Breakdown

## 12.1 Proposed module structure
```txt
src/
  background/
    index.ts
    alarms.ts
    notifications.ts
    messageRouter.ts
  content/
    index.ts
    detector.ts
    classifier.ts
    extractor.ts
    promptState.ts
  popup/
    Popup.tsx
    TrackPrompt.tsx
    ManualEntryForm.tsx
  dashboard/
    Dashboard.tsx
    SubscriptionList.tsx
    SubscriptionCard.tsx
    SubscriptionEditor.tsx
  services/
    subscriptionService.ts
    reminderService.ts
    statusService.ts
    duplicateService.ts
  repository/
    subscriptionRepository.ts
    preferencesRepository.ts
  types/
    subscription.ts
    reminder.ts
    preferences.ts
  utils/
    dates.ts
    currency.ts
    validation.ts
    ids.ts
```

## 12.2 Service definitions

### subscriptionService
Owns create, update, archive, cancel, and renew workflows.

### reminderService
Owns reminder date calculation, due scan logic, and reminder delivery rules.

### statusService
Owns section grouping and status derivation.

### duplicateService
Owns duplicate detection heuristics.

### repository layer
Encapsulates storage reads/writes and shields business logic from storage API details.

---

## 13. Engineering Decisions

### Decision 1: local-first storage
Chosen for speed, privacy, and MVP simplicity.

### Decision 2: manual entry included from day one
Chosen because detection accuracy will not be perfect and manual fallback is critical.

### Decision 3: daily scan reminder engine
Chosen because it is simpler and more reliable than many per-record alarms.

### Decision 4: heuristic detection before AI extraction
Chosen because it is predictable, faster to implement, and adequate for MVP.

### Decision 5: React + TypeScript
Chosen for maintainability and scalability as UI grows.

---

## 14. Architecture Summary

The app architecture is built around a modular Chrome Extension system where:

- the **Detection System** finds likely subscription events
- the **Tracking System** captures user intent and details
- the **Data Management System** stores structured subscription records
- the **Reminder System** scans for due renewals and dispatches notifications
- the **Dashboard System** gives users clear visibility and control
- the **Settings System** manages reminder preferences and extension behavior

This architecture is lean enough for an MVP but structured enough to grow into a more intelligent, synced product later.

---

## 15. Recommended Build Order by System

### Phase 1
- Extension Shell System
- Subscription Data Management System
- Dashboard and Management System
- Reminder and Notification System

### Phase 2
- Manual Entry Form
- Intent Capture and Tracking System

### Phase 3
- Subscription Detection System
- Prompt suppression logic
- Duplicate detection

### Phase 4
- Settings and Preferences System
- polish and reliability hardening

This order ensures the product is usable even before auto-detection becomes strong.

### Product logic update: core intent buckets

The product uses only 3 primary intent buckets:

1. `cancel`
Meaning: the user already plans to cancel this subscription before the next charge.

Helper text:
“You already plan to cancel this before the next charge. We will send you a reminder 3 days before the renewal date.”

System behavior:
- Show under Cancel in dashboard
- Include in Cancel summary count
- Send reminder 3 days before renewal date
- Surface urgent actions like opening cancellation link

2. `renew`
Meaning: the user wants to keep this subscription and let it continue.

Helper text:
“You want to keep this subscription and let it continue. This is a heads-up that charge is expected.”

System behavior:
- Show under Renew in dashboard
- Include in Renew summary count
- Send reminder as a heads-up before billing
- Do not imply the product renews the subscription itself

3. `remind_before_billing`
Meaning: the user wants a reminder so they can decide later.

Helper text:
“You want a reminder so you can decide later.”

System behavior:
- Show under Remind Before Billing in dashboard
- Include in Remind Before Billing summary count
- Send reminder before billing as a decision reminder
- Allow user to switch to Cancel or Renew later

### Dashboard structure update

Top summary cards:
- Cancel
- Renew
- Remind Before Billing

Main tabs:
- All
- Cancel
- Renew
- Remind Before Billing

Rules:
- Do not include main dashboard sections
- Do not include archived items in the MVP dashboard
- Do not use Active, Trials, Marked for cancellation, Marked for renewal, or Archived as dashboard categories
- Trial information is supporting metadata only, not a main tab, section, or summary card