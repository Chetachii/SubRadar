import type { Subscription } from '../types/subscription'
import type { ReminderPoint } from '../types/reminder'
import { listSubscriptions } from '../repository/subscriptionRepository'
import { getPreferences } from '../repository/preferencesRepository'
import { scanDueReminders, getEligibleReminderPoints } from '../services/reminderService'
import * as subscriptionService from '../services/subscriptionService'
import { addDays, today, daysBetween } from '../utils/dates'
import { formatCurrency } from '../utils/currency'

export const NOTIF_ACTION = {
  SNOOZE: 0,
  DISMISS: 1,
}

function intentMessage(sub: Subscription, point: ReminderPoint): string {
  const cost = sub.cost !== undefined ? ` · ${formatCurrency(sub.cost, sub.currency)}` : ''

  if (point === 'renewal_day') {
    if (sub.intent === 'cancel') return `Renewing today${cost}. You planned to cancel.`
    if (sub.intent === 'renew')  return `Renewing today${cost}. Charge expected.`
    return `Renewing today${cost}. Decide now.`
  }

  // 'early' — show exact days remaining
  const daysLeft = sub.renewalDate ? daysBetween(today(), sub.renewalDate) : 3
  const dayStr = daysLeft === 1 ? '1 day' : `${daysLeft} days`
  if (sub.intent === 'cancel') return `Renews in ${dayStr}${cost}. You planned to cancel.`
  if (sub.intent === 'renew')  return `Renews in ${dayStr}${cost}. Charge expected.`
  return `Renews in ${dayStr}${cost}. Decide before billing.`
}

export function buildNotificationOptions(
  sub: Subscription,
  point: ReminderPoint,
): chrome.notifications.NotificationOptions<true> {
  return {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon48.png'),
    title: `SubRadar: ${sub.serviceName}`,
    message: intentMessage(sub, point),
    buttons: [{ title: 'Snooze 1 day' }, { title: 'Dismiss' }],
    requireInteraction: true,
  }
}

export function dispatchReminderNotification(sub: Subscription, point: ReminderPoint): void {
  const suffix = point === 'early' ? 'early' : 'renewal'
  const notifId = `subradar-${sub.id}-${suffix}`
  const options = buildNotificationOptions(sub, point)
  console.log('[SubRadar] calling chrome.notifications.create', notifId, options)
  chrome.notifications.create(notifId, options, (createdId) => {
    if (chrome.runtime.lastError) {
      console.error('[SubRadar] notifications.create error:', chrome.runtime.lastError.message)
    } else {
      console.log('[SubRadar] notification created OK, id:', createdId)
    }
  })
}

export async function runScan(): Promise<void> {
  console.log('[SubRadar] runScan started')
  const [subscriptions, prefs] = await Promise.all([listSubscriptions(), getPreferences()])
  console.log('[SubRadar] subs loaded:', subscriptions.length, '| notificationsEnabled:', prefs.notificationsEnabled)
  const due = scanDueReminders(subscriptions, prefs)
  console.log('[SubRadar] eligible subs:', due.map(s => `${s.serviceName} (renewalDate: ${s.renewalDate}, lastReminderSentAt: ${s.lastReminderSentAt})`))

  for (const sub of due) {
    const points = getEligibleReminderPoints(sub, prefs)
    console.log('[SubRadar]', sub.serviceName, '→ points:', points)
    for (const point of points) {
      dispatchReminderNotification(sub, point)
    }
    if (points[0] === 'renewal_day') {
      await subscriptionService.rollRenewalDate(sub.id, prefs)
    } else {
      await subscriptionService.stampReminderSent(sub.id)
    }
  }

  await chrome.storage.local.set({
    runtimeMeta: { lastReminderScanAt: new Date().toISOString() },
  })
  await updateBadge()
}

export async function updateBadge(): Promise<void> {
  const subscriptions = await listSubscriptions()
  const qualifying = subscriptions.filter((sub) => {
    if (sub.status !== 'active' || !sub.renewalDate) return false
    const days = daysBetween(today(), sub.renewalDate)
    return days >= 0 && days <= 3
  })
  const count = qualifying.length
  console.log('[SubRadar] updateBadge — today:', today(), '| qualifying:', qualifying.map(s => `${s.serviceName} (${s.renewalDate}, ${daysBetween(today(), s.renewalDate!)}d)`), '| count:', count)
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#E74C3C' })
}

export async function handleNotificationButtonClick(
  notifId: string,
  buttonIndex: number,
): Promise<void> {
  const subId = notifId
    .replace(/^subradar-/, '')
    .replace(/-(?:early|renewal)$/, '')

  if (buttonIndex === NOTIF_ACTION.SNOOZE) {
    await subscriptionService.setSnooze(subId, addDays(today(), 1))
  } else if (buttonIndex === NOTIF_ACTION.DISMISS) {
    await subscriptionService.dismissReminder(subId)
  }

  chrome.notifications.clear(notifId)
}
