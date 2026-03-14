import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import { isDateReached, subtractDays, today } from '../utils/dates'

/** Returns the effective due date for a subscription: renewalDate → trialEndDate → null */
export function resolveDueDate(sub: Subscription): string | null {
  return sub.renewalDate ?? sub.trialEndDate ?? null
}

/** Returns the computed reminder date (due date minus lead days), or null if no due date */
export function computeReminderDate(sub: Subscription, leadDays: number): string | null {
  const dueDate = resolveDueDate(sub)
  if (!dueDate) return null
  return subtractDays(dueDate, leadDays)
}

/** Returns true if this subscription is eligible for a reminder notification today */
export function isEligibleForReminder(sub: Subscription, prefs: Preferences): boolean {
  if (sub.status === 'archived' || sub.status === 'canceled') return false
  if (!prefs.notificationsEnabled) return false

  const reminderDate = sub.reminderDate ?? computeReminderDate(sub, prefs.reminderLeadDays)
  if (!reminderDate) return false
  if (!isDateReached(reminderDate)) return false

  if (sub.snoozedUntil && !isDateReached(sub.snoozedUntil)) return false
  if (sub.lastReminderSentAt && sub.lastReminderSentAt >= today()) return false

  return true
}

/** Scans all subscriptions and returns those that need a reminder today */
export function scanDueReminders(
  subscriptions: Subscription[],
  prefs: Preferences,
): Subscription[] {
  return subscriptions.filter((sub) => isEligibleForReminder(sub, prefs))
}
