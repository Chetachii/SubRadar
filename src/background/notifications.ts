import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import type { ReminderPoint } from '../types/reminder'
import { listSubscriptions } from '../repository/subscriptionRepository'
import { getPreferences } from '../repository/preferencesRepository'
import { scanDueReminders, getEligibleReminderPoints, isEligibleForReminder } from '../services/reminderService'
import * as subscriptionService from '../services/subscriptionService'
import { addDays, today, daysBetween, isDateReached } from '../utils/dates'
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
  console.log('[SubRadar] chrome.notifications.create', notifId, Date.now())
  chrome.notifications.create(notifId, options, (createdId) => {
    if (chrome.runtime.lastError) {
      console.error('[SubRadar] notifications.create error:', chrome.runtime.lastError.message)
    } else {
      console.log('[SubRadar] notification created OK, id:', createdId, Date.now())
    }
  })
}

/**
 * Immediately checks a single subscription for eligibility and dispatches a
 * notification using already-loaded data — no Supabase fetch needed.
 * Returns the set of notification point suffixes dispatched (so runScan can
 * skip this sub and avoid a double-dispatch race).
 */
export function dispatchIfEligible(sub: Subscription, prefs: Preferences): boolean {
  if (!isEligibleForReminder(sub, prefs)) return false
  const points = getEligibleReminderPoints(sub, prefs)
  if (points.length === 0) return false
  console.log('[SubRadar] dispatchIfEligible →', sub.serviceName, Date.now())
  for (const point of points) {
    dispatchReminderNotification(sub, point)
  }
  // Stamp/roll async — fire-and-forget; runScan will skip this sub via skipIds
  if (points[0] === 'renewal_day') {
    subscriptionService.rollRenewalDate(sub.id, prefs).catch(err =>
      console.error('[SubRadar] rollRenewalDate error:', err))
  } else {
    subscriptionService.stampReminderSent(sub.id).catch(err =>
      console.error('[SubRadar] stampReminderSent error:', err))
  }
  return true
}

interface RunScanOpts {
  /** Pre-loaded preferences — skips getPreferences() Supabase call */
  prefs?: Preferences
  /** Subscription IDs already dispatched by the caller — skips them to prevent double-fire */
  skipIds?: Set<string>
}

export async function runScan(opts?: RunScanOpts): Promise<void> {
  const t0 = Date.now()
  console.log('[SubRadar] runScan started', t0)

  const [subscriptions, prefs] = await Promise.all([
    listSubscriptions(),
    opts?.prefs ? Promise.resolve(opts.prefs) : getPreferences(),
  ])
  console.log('[SubRadar] runScan data loaded in', Date.now() - t0, 'ms | subs:', subscriptions.length)

  // Auto-archive active subscriptions overdue by 7+ days
  const overdueIds = new Set(
    subscriptions
      .filter((s) => s.status === 'active' && s.renewalDate && daysBetween(today(), s.renewalDate) <= -7)
      .map((s) => s.id)
  )
  for (const id of overdueIds) {
    await subscriptionService.archiveSubscription(id)
  }
  if (overdueIds.size > 0) {
    console.log('[SubRadar] auto-archived overdue subs:', [...overdueIds])
  }

  // Exclude just-archived subs and already-dispatched subs from the reminder scan
  const toScan = subscriptions.filter((s) =>
    !overdueIds.has(s.id) && !opts?.skipIds?.has(s.id)
  )

  const due = scanDueReminders(toScan, prefs)
  console.log('[SubRadar] due:', due.map(s => `${s.serviceName} (${s.renewalDate}, sent: ${s.lastReminderSentAt})`))

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
  await updateBadge(subscriptions)
}

export async function updateBadge(subscriptions?: Subscription[]): Promise<void> {
  const subs = subscriptions ?? await listSubscriptions()
  const qualifying = subs.filter((sub) => {
    if (sub.status !== 'active' || !sub.renewalDate) return false
    if (sub.snoozedUntil && !isDateReached(sub.snoozedUntil)) return false
    const days = daysBetween(today(), sub.renewalDate)
    return days >= 0 && days <= 3
  })
  const count = qualifying.length
  console.log('[SubRadar] updateBadge count:', count, '| qualifying:', qualifying.map(s => `${s.serviceName}(snoozedUntil=${s.snoozedUntil ?? 'none'})`))

  chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' })
  chrome.action.setBadgeBackgroundColor({ color: '#E74C3C' })
  chrome.action.setBadgeTextColor({ color: '#FFFFFF' })
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
  await updateBadge()
}
