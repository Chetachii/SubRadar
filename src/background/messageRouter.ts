import type { DetectionResult } from '../types/subscription'
import { getPreferences } from '../repository/preferencesRepository'
import * as subscriptionService from '../services/subscriptionService'
import { runScan, updateBadge, dispatchIfEligible } from './notifications'
import { logEvent } from '../repository/analyticsRepository'

interface Message {
  type: string
  payload?: unknown
}

export function registerMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      console.error('[SubRadar] Message error:', err)
      sendResponse({ error: String(err) })
    })
    return true // keep channel open for async response
  })
}

async function handleMessage(message: Message): Promise<unknown> {
  switch (message.type) {
    case 'DETECTION_FOUND': {
      const result = message.payload as DetectionResult
      await chrome.storage.session.set({ pendingDetection: result })
      void logEvent('detection_triggered', { sourceDomain: result.sourceDomain })
      return { ok: true }
    }

    case 'SAVE_SUBSCRIPTION': {
      const prefs = await getPreferences()
      const input = message.payload as Parameters<typeof subscriptionService.createSubscription>[0]
      const sub = await subscriptionService.createSubscription(input, prefs)
      // Dispatch immediately using already-loaded data — zero additional Supabase calls
      const dispatched = dispatchIfEligible(sub, prefs)
      // Run full scan async for badge + other subs; skip sub if already dispatched above
      runScan({ prefs, skipIds: dispatched ? new Set([sub.id]) : undefined })
      void logEvent('subscription_created', { serviceName: sub.serviceName })
      return { ok: true, subscription: sub }
    }

    case 'UPDATE_SUBSCRIPTION': {
      const prefs = await getPreferences()
      const { id, patch } = message.payload as { id: string; patch: Parameters<typeof subscriptionService.updateSubscription>[1] }
      const sub = await subscriptionService.updateSubscription(id, patch, prefs)
      const dispatched = dispatchIfEligible(sub, prefs)
      runScan({ prefs, skipIds: dispatched ? new Set([sub.id]) : undefined })
      void logEvent('subscription_updated', { id })
      return { ok: true, subscription: sub }
    }

    case 'OPEN_DASHBOARD': {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
      return { ok: true }
    }

    case 'RUN_REMINDER_SCAN': {
      await runScan()
      return { ok: true }
    }

    case 'DELETE_SUBSCRIPTION': {
      const { id } = message.payload as { id: string }
      await subscriptionService.deleteSubscription(id)
      void logEvent('subscription_deleted', { id })
      return { ok: true }
    }

    case 'SNOOZE_SUBSCRIPTION': {
      const { id, until } = message.payload as { id: string; until: string }
      const sub = await subscriptionService.setSnooze(id, until)
      await updateBadge()
      void logEvent('reminder_snoozed', { id, until })
      return { ok: true, subscription: sub }
    }

    case 'MARK_RENEWED': {
      const { id } = message.payload as { id: string }
      const sub = await subscriptionService.markRenewed(id)
      return { ok: true, subscription: sub }
    }

    case 'DISMISS_REMINDER': {
      const { id } = message.payload as { id: string }
      const sub = await subscriptionService.dismissReminder(id)
      await updateBadge()
      void logEvent('reminder_dismissed', { id })
      return { ok: true, subscription: sub }
    }

    default:
      return { error: `Unknown message type: ${message.type}` }
  }
}
