import type { DetectionResult } from '../types/subscription'
import { getPreferences } from '../repository/preferencesRepository'
import * as subscriptionService from '../services/subscriptionService'
import { runScan } from './notifications'

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
  const prefs = await getPreferences()

  switch (message.type) {
    case 'DETECTION_FOUND': {
      const result = message.payload as DetectionResult
      await chrome.storage.session.set({ pendingDetection: result })
      return { ok: true }
    }

    case 'SAVE_SUBSCRIPTION': {
      const input = message.payload as Parameters<typeof subscriptionService.createSubscription>[0]
      const sub = await subscriptionService.createSubscription(input, prefs)
      await runScan()
      return { ok: true, subscription: sub }
    }

    case 'UPDATE_SUBSCRIPTION': {
      const { id, patch } = message.payload as { id: string; patch: Parameters<typeof subscriptionService.updateSubscription>[1] }
      const sub = await subscriptionService.updateSubscription(id, patch, prefs)
      await runScan()
      return { ok: true, subscription: sub }
    }

    case 'RUN_REMINDER_SCAN': {
      await runScan()
      return { ok: true }
    }

    case 'SNOOZE_SUBSCRIPTION': {
      const { id, until } = message.payload as { id: string; until: string }
      const sub = await subscriptionService.setSnooze(id, until)
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
      return { ok: true, subscription: sub }
    }

    default:
      return { error: `Unknown message type: ${message.type}` }
  }
}
