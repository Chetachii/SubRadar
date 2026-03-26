import type { Subscription, Intent, BillingFrequency } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import * as repo from '../repository/subscriptionRepository'
import { validateSubscription } from '../utils/validation'
import { addDays, addMonths, today } from '../utils/dates'
import { computeReminderDate, resolveDueDate } from './reminderService'

type CreateInput = Pick<Subscription, 'serviceName' | 'intent' | 'detectionSource'> &
  Partial<Omit<Subscription, 'id' | 'createdAt' | 'updatedAt' | 'serviceName' | 'intent' | 'detectionSource'>>

export async function createSubscription(
  input: CreateInput,
  prefs: Preferences,
): Promise<Subscription> {
  const errors = validateSubscription(input)
  if (errors.length > 0) throw new Error(errors.join(' '))

  const reminderDate =
    input.reminderDate ??
    computeReminderDate({ ...input } as Subscription, prefs.reminderLeadDays) ??
    undefined

  return repo.createSubscription({
    ...input,
    serviceName: input.serviceName.trim(),
    status: 'active',
    reminderDate,
  })
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
  prefs: Preferences,
): Promise<Subscription> {
  const errors = validateSubscription(patch)
  if (errors.length > 0) throw new Error(errors.join(' '))

  const existing = await repo.getSubscriptionById(id)
  if (!existing) throw new Error(`Subscription not found: ${id}`)

  const merged = { ...existing, ...patch }
  const reminderDate =
    patch.reminderDate ??
    computeReminderDate(merged as Subscription, prefs.reminderLeadDays) ??
    existing.reminderDate

  // If the renewal date changed, reset reminder state so the new cycle is fresh
  const renewalDateChanged =
    patch.renewalDate !== undefined && patch.renewalDate !== existing.renewalDate

  return repo.updateSubscription(id, {
    ...patch,
    reminderDate,
    ...(renewalDateChanged && {
      lastReminderSentAt: null as unknown as undefined,
      snoozedUntil: null as unknown as undefined,
    }),
  })
}

export async function archiveSubscription(id: string): Promise<Subscription> {
  return repo.updateSubscription(id, { status: 'archived' })
}

export async function cancelSubscription(id: string): Promise<Subscription> {
  return repo.updateSubscription(id, { status: 'canceled' })
}

export async function deleteSubscription(id: string): Promise<void> {
  return repo.deleteSubscription(id)
}

export async function markRenewed(id: string): Promise<Subscription> {
  const sub = await repo.getSubscriptionById(id)
  if (!sub) throw new Error(`Subscription not found: ${id}`)

  const dueDate = resolveDueDate(sub)
  let nextRenewalDate: string | undefined

  if (dueDate && sub.billingFrequency) {
    const daysToAdd = billingFrequencyToDays(sub.billingFrequency)
    nextRenewalDate = daysToAdd ? addDays(dueDate, daysToAdd) : undefined
  }

  return repo.updateSubscription(id, {
    status: 'active',
    renewalDate: nextRenewalDate,
    lastReminderSentAt: today(),
  })
}

export async function setSnooze(id: string, until: string): Promise<Subscription> {
  return repo.updateSubscription(id, { snoozedUntil: until })
}

export async function stampReminderSent(id: string): Promise<Subscription> {
  return repo.updateSubscription(id, { lastReminderSentAt: today() })
}

/**
 * Called by runScan after a renewal_day notification fires.
 * Advances renewalDate by one billing cycle using calendar-accurate month arithmetic,
 * recomputes reminderDate, and clears lastReminderSentAt + snoozedUntil for the new cycle.
 * No-ops (returns sub unchanged) if status is canceled or archived.
 * Falls back to a plain timestamp if billingFrequency is absent.
 */
export async function rollRenewalDate(id: string, prefs: Preferences): Promise<Subscription> {
  const sub = await repo.getSubscriptionById(id)
  if (!sub) throw new Error(`Subscription not found: ${id}`)
  if (sub.status === 'canceled' || sub.status === 'archived') return sub
  if (!sub.renewalDate || !sub.billingFrequency) {
    return repo.updateSubscription(id, { lastReminderSentAt: today() })
  }

  const nextRenewalDate = advanceDateByFrequency(sub.renewalDate, sub.billingFrequency)
  const nextReminderDate =
    computeReminderDate({ ...sub, renewalDate: nextRenewalDate }, prefs.reminderLeadDays) ??
    undefined

  return repo.updateSubscription(id, {
    renewalDate: nextRenewalDate,
    reminderDate: nextReminderDate,
    // null clears the DB columns; toRow passes any non-undefined value to Supabase
    lastReminderSentAt: null as unknown as undefined,
    snoozedUntil: null as unknown as undefined,
  })
}

function advanceDateByFrequency(isoDate: string, freq: BillingFrequency): string {
  switch (freq) {
    case 'weekly':    return addDays(isoDate, 7)
    case 'monthly':   return addMonths(isoDate, 1)
    case 'quarterly': return addMonths(isoDate, 3)
    case 'yearly':    return addMonths(isoDate, 12)
    default:          return isoDate
  }
}

/**
 * Dismisses the current reminder instance for this subscription.
 * Sets snoozedUntil = renewalDate, suppressing reminders until billing day.
 * On the renewal date itself isDateReached(snoozedUntil) becomes true,
 * so the snooze expires and the renewal-day reminder still fires as expected.
 * Different from setSnooze (24h) — dismiss silences the entire pre-billing window.
 */
export async function dismissReminder(id: string): Promise<Subscription> {
  const sub = await repo.getSubscriptionById(id)
  if (!sub) throw new Error(`Subscription not found: ${id}`)
  const dueDate = resolveDueDate(sub)
  const snoozeUntil = dueDate ?? addDays(today(), 7)
  return repo.updateSubscription(id, { snoozedUntil: snoozeUntil })
}

function billingFrequencyToDays(freq: BillingFrequency): number | null {
  switch (freq) {
    case 'weekly': return 7
    case 'monthly': return 30
    case 'quarterly': return 91
    case 'yearly': return 365
    default: return null
  }
}

export { Intent }
