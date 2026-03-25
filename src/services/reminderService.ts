import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import type { ReminderState, ReminderSummary, ReminderPoint } from '../types/reminder'
import { isDateReached, subtractDays, today, daysBetween } from '../utils/dates'

/** Returns the effective due date for a subscription: renewalDate only */
export function resolveDueDate(sub: Subscription): string | null {
  return sub.renewalDate ?? null
}

/** Returns the computed reminder date (due date minus lead days), or null if no due date */
export function computeReminderDate(sub: Subscription, leadDays: number): string | null {
  const dueDate = resolveDueDate(sub)
  if (!dueDate) return null
  return subtractDays(dueDate, leadDays)
}

/**
 * Returns the reminder point(s) eligible for notification today.
 * Returns at most one element — the two windows are mutually exclusive.
 * Snooze is checked by the caller (isEligibleForReminder) before this is called.
 */
export function getEligibleReminderPoints(
  sub: Subscription,
  prefs: Preferences,
): ReminderPoint[] {
  const renewalDate = sub.renewalDate!  // caller verified this exists

  // Renewal-day window: on or after renewalDate
  if (isDateReached(renewalDate)) {
    if (sub.lastReminderSentAt && sub.lastReminderSentAt >= renewalDate) return []
    return ['renewal_day']
  }

  // Early window: [firstDate, renewalDate)
  const firstDate = sub.reminderDate ?? computeReminderDate(sub, prefs.reminderLeadDays)
  if (!firstDate || !isDateReached(firstDate)) return []
  if (sub.lastReminderSentAt && sub.lastReminderSentAt >= firstDate) return []
  return ['early']
}

/** Returns true if this subscription is eligible for a reminder notification today */
export function isEligibleForReminder(sub: Subscription, prefs: Preferences): boolean {
  if (sub.status === 'archived' || sub.status === 'canceled') return false
  if (!prefs.notificationsEnabled) return false
  if (!sub.renewalDate) return false
  if (sub.snoozedUntil && !isDateReached(sub.snoozedUntil)) return false
  return getEligibleReminderPoints(sub, prefs).length > 0
}

/** Scans all subscriptions and returns those that need a reminder today */
export function scanDueReminders(
  subscriptions: Subscription[],
  prefs: Preferences,
): Subscription[] {
  return subscriptions.filter((sub) => isEligibleForReminder(sub, prefs))
}

/**
 * Derives the current reminder state for a subscription.
 * Pure function — safe to call on every render.
 *
 * Evaluation order:
 *   1. snoozed   — snoozedUntil is still in the future
 *   2. overdue   — reminder date has passed (includes the renewal day itself and beyond)
 *   3. due_today — today is exactly the reminder trigger date (3 days before renewal)
 *   4. upcoming  — reminder window hasn't opened yet
 *
 * Returns 'upcoming' if no renewalDate is set — callers should only display
 * reminder UI for subscriptions that have a renewalDate.
 */
export function getReminderState(sub: Subscription, prefs: Preferences): ReminderState {
  const dueDate = resolveDueDate(sub)
  if (!dueDate) return 'upcoming'

  // Snoozed overrides all date-based states
  if (sub.snoozedUntil && !isDateReached(sub.snoozedUntil)) return 'snoozed'

  const todayStr = today()
  const reminderDate = sub.reminderDate ?? computeReminderDate(sub, prefs.reminderLeadDays)

  // Reminder window hasn't opened yet
  if (!reminderDate || reminderDate > todayStr) return 'upcoming'

  // Today is exactly the reminder trigger date
  if (reminderDate === todayStr) return 'due_today'

  // Reminder date has passed — renewal is imminent or has already occurred
  return 'overdue'
}

/**
 * Returns computed reminder context for a subscription.
 * Returns null if the subscription has no renewalDate — reminder logic does not apply.
 * Reusable by dashboard cards and the notification layer.
 */
export function getReminderSummary(sub: Subscription, prefs: Preferences): ReminderSummary | null {
  const dueDate = resolveDueDate(sub)
  if (!dueDate) return null

  return {
    subscriptionId: sub.id,
    state: getReminderState(sub, prefs),
    dueDate,
    daysUntilDue: daysBetween(today(), dueDate),
    isFreeTrial: sub.isFreeTrial ?? false,
  }
}
