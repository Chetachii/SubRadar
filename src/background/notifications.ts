import type { Subscription } from '../types/subscription'
import { listSubscriptions } from '../repository/subscriptionRepository'
import { getPreferences } from '../repository/preferencesRepository'
import { scanDueReminders } from '../services/reminderService'
import * as subscriptionService from '../services/subscriptionService'
import { addDays, today } from '../utils/dates'
import { formatCurrency } from '../utils/currency'

export const NOTIF_ACTION = {
  OPEN_CANCEL: 0,
  SNOOZE: 1,
  MARK_RENEWED: 2,
}

export function buildNotificationOptions(
  sub: Subscription,
): chrome.notifications.NotificationOptions<true> {
  const costStr = sub.cost !== undefined ? ` · ${formatCurrency(sub.cost, sub.currency)}` : ''
  return {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `SubRadar: ${sub.serviceName}`,
    message: `Renewal coming up${costStr}. Time to decide.`,
    buttons: [
      { title: 'Open cancellation page' },
      { title: 'Snooze 24h' },
      { title: 'Mark renewed' },
    ],
    requireInteraction: true,
  }
}

export function dispatchReminderNotification(sub: Subscription): void {
  const options = buildNotificationOptions(sub)
  chrome.notifications.create(`subradar-${sub.id}`, options)
}

export async function runScan(): Promise<void> {
  const [subscriptions, prefs] = await Promise.all([listSubscriptions(), getPreferences()])
  const due = scanDueReminders(subscriptions, prefs)

  for (const sub of due) {
    dispatchReminderNotification(sub)
    await subscriptionService.setSnooze(sub.id, today())
  }

  await chrome.storage.local.set({
    runtimeMeta: { lastReminderScanAt: new Date().toISOString() },
  })
}

export async function handleNotificationButtonClick(
  notifId: string,
  buttonIndex: number,
): Promise<void> {
  const subId = notifId.replace('subradar-', '')

  if (buttonIndex === NOTIF_ACTION.OPEN_CANCEL) {
    const subs = await listSubscriptions()
    const sub = subs.find((s) => s.id === subId)
    if (sub?.cancellationUrl) {
      chrome.tabs.create({ url: sub.cancellationUrl })
    }
  } else if (buttonIndex === NOTIF_ACTION.SNOOZE) {
    const snoozeUntil = addDays(today(), 1)
    await subscriptionService.setSnooze(subId, snoozeUntil)
  } else if (buttonIndex === NOTIF_ACTION.MARK_RENEWED) {
    const prefs = await getPreferences()
    await subscriptionService.markRenewed(subId)
    void prefs // used for future renewal date logic
  }

  chrome.notifications.clear(notifId)
}
