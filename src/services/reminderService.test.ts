import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  resolveDueDate,
  computeReminderDate,
  isEligibleForReminder,
  scanDueReminders,
  getEligibleReminderPoints,
} from './reminderService'
import { makeSubscription, makePreferences } from '../test/factories'

const TODAY = '2024-06-15'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('resolveDueDate', () => {
  it('prefers renewalDate over trialEndDate', () => {
    const sub = makeSubscription({ renewalDate: '2024-07-01', trialEndDate: '2024-06-20' })
    expect(resolveDueDate(sub)).toBe('2024-07-01')
  })

  it('returns null when only trialEndDate is set (no renewalDate)', () => {
    const sub = makeSubscription({ trialEndDate: '2024-06-20' })
    expect(resolveDueDate(sub)).toBeNull()
  })

  it('returns null when neither date is set', () => {
    const sub = makeSubscription()
    expect(resolveDueDate(sub)).toBeNull()
  })
})

describe('computeReminderDate', () => {
  it('subtracts lead days from renewalDate', () => {
    const sub = makeSubscription({ renewalDate: '2024-06-18' })
    expect(computeReminderDate(sub, 3)).toBe('2024-06-15')
  })

  it('returns null when no due date', () => {
    const sub = makeSubscription()
    expect(computeReminderDate(sub, 3)).toBeNull()
  })

  it('handles zero lead days', () => {
    const sub = makeSubscription({ renewalDate: '2024-06-20' })
    expect(computeReminderDate(sub, 0)).toBe('2024-06-20')
  })

  it('returns null when only trialEndDate is set (no renewalDate)', () => {
    const sub = makeSubscription({ trialEndDate: '2024-06-22' })
    expect(computeReminderDate(sub, 3)).toBeNull()
  })
})

describe('isEligibleForReminder', () => {
  const basePrefs = makePreferences({ notificationsEnabled: true, reminderLeadDays: 3 })

  it('returns true when all conditions are met', () => {
    const sub = makeSubscription({
      status: 'active',
      renewalDate: '2024-06-18',
      reminderDate: TODAY,
    })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(true)
  })

  it('returns false for archived subscription', () => {
    const sub = makeSubscription({ status: 'archived', reminderDate: TODAY })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns false for canceled subscription', () => {
    const sub = makeSubscription({ status: 'canceled', reminderDate: TODAY })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns false when notifications are disabled', () => {
    const sub = makeSubscription({ status: 'active', reminderDate: TODAY })
    const prefs = makePreferences({ notificationsEnabled: false })
    expect(isEligibleForReminder(sub, prefs)).toBe(false)
  })

  it('returns false when no reminder date and no due date', () => {
    const sub = makeSubscription({ status: 'active' })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns false when reminder date is in the future', () => {
    const sub = makeSubscription({ status: 'active', reminderDate: '2024-06-20' })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns true on exact boundary day (reminder date = today)', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: '2024-06-18', reminderDate: TODAY })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(true)
  })

  it('returns false on day before reminder date', () => {
    vi.setSystemTime(new Date('2024-06-14T12:00:00Z'))
    const sub = makeSubscription({ status: 'active', reminderDate: TODAY })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns false when snoozed until future date', () => {
    const sub = makeSubscription({
      status: 'active',
      reminderDate: TODAY,
      snoozedUntil: '2024-06-20',
    })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns true when snooze has expired', () => {
    const sub = makeSubscription({
      status: 'active',
      renewalDate: '2024-06-18',
      reminderDate: TODAY,
      snoozedUntil: '2024-06-10',
    })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(true)
  })

  it('returns false when reminder already sent in this cycle (lastReminderSentAt >= reminderDate)', () => {
    const sub = makeSubscription({
      status: 'active',
      renewalDate: '2024-06-18',
      reminderDate: TODAY,
      lastReminderSentAt: TODAY,
    })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(false)
  })

  it('returns true when last reminder was sent before this cycle (per-cycle dedup)', () => {
    // lastReminderSentAt = '2024-06-01' < reminderDate = TODAY → different cycle → eligible
    const sub = makeSubscription({
      status: 'active',
      renewalDate: '2024-06-18',
      reminderDate: TODAY,
      lastReminderSentAt: '2024-06-01',
    })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(true)
  })

  it('computes reminder date from renewalDate when reminderDate is absent', () => {
    // renewalDate = June 18, leadDays = 3 → reminderDate = June 15 = today → eligible
    const sub = makeSubscription({ status: 'active', renewalDate: '2024-06-18' })
    expect(isEligibleForReminder(sub, basePrefs)).toBe(true)
  })
})

describe('getEligibleReminderPoints', () => {
  const prefs = makePreferences({ notificationsEnabled: true, reminderLeadDays: 3 })

  it("returns ['early'] when inside T-3 window and nothing sent yet", () => {
    const sub = makeSubscription({ renewalDate: '2024-06-18', reminderDate: TODAY })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual(['early'])
  })

  it('returns [] when firstDate not yet reached', () => {
    const sub = makeSubscription({ renewalDate: '2024-06-25', reminderDate: '2024-06-22' })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual([])
  })

  it('returns [] when early already sent (lastReminderSentAt >= firstDate)', () => {
    const sub = makeSubscription({
      renewalDate: '2024-06-18',
      reminderDate: TODAY,
      lastReminderSentAt: TODAY,
    })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual([])
  })

  it("returns ['early'] when lastReminderSentAt is from a prior cycle (< firstDate)", () => {
    const sub = makeSubscription({
      renewalDate: '2024-06-18',
      reminderDate: TODAY,
      lastReminderSentAt: '2024-05-15',
    })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual(['early'])
  })

  it("returns ['early'] when sub.reminderDate override is reached and before renewalDate", () => {
    const sub = makeSubscription({ renewalDate: '2024-06-20', reminderDate: TODAY })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual(['early'])
  })

  it("returns ['renewal_day'] when today equals renewalDate", () => {
    const sub = makeSubscription({ renewalDate: TODAY })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual(['renewal_day'])
  })

  it("returns ['renewal_day'] when renewalDate has passed (overdue)", () => {
    const sub = makeSubscription({ renewalDate: '2024-06-10' })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual(['renewal_day'])
  })

  it('returns [] when lastReminderSentAt >= renewalDate (renewal-day already sent)', () => {
    const sub = makeSubscription({
      renewalDate: TODAY,
      lastReminderSentAt: TODAY,
    })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual([])
  })

  it("returns ['renewal_day'] when early was sent at T-3 but renewalDate is now reached", () => {
    const sub = makeSubscription({
      renewalDate: TODAY,
      reminderDate: '2024-06-12',
      lastReminderSentAt: '2024-06-12',
    })
    expect(getEligibleReminderPoints(sub, prefs)).toEqual(['renewal_day'])
  })

  it('result is mutually exclusive: at most one point fires for any input', () => {
    const cases = [
      makeSubscription({ renewalDate: '2024-06-18', reminderDate: TODAY }),
      makeSubscription({ renewalDate: TODAY }),
      makeSubscription({ renewalDate: '2024-06-10' }),
      makeSubscription({ renewalDate: '2024-06-25', reminderDate: '2024-06-22' }),
    ]
    for (const sub of cases) {
      expect(getEligibleReminderPoints(sub, prefs).length).toBeLessThanOrEqual(1)
    }
  })
})

describe('scanDueReminders', () => {
  const prefs = makePreferences({ notificationsEnabled: true, reminderLeadDays: 3 })

  it('returns only eligible subscriptions', () => {
    const eligible = makeSubscription({ status: 'active', renewalDate: '2024-06-18', reminderDate: TODAY })
    const notEligible = makeSubscription({ status: 'archived', renewalDate: '2024-06-18', reminderDate: TODAY })
    const future = makeSubscription({ status: 'active', renewalDate: '2025-01-03', reminderDate: '2024-12-31' })
    const result = scanDueReminders([eligible, notEligible, future], prefs)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(eligible.id)
  })

  it('returns empty array when none are eligible', () => {
    const subs = [makeSubscription({ status: 'archived' }), makeSubscription({ status: 'canceled' })]
    expect(scanDueReminders(subs, prefs)).toHaveLength(0)
  })

  it('returns all eligible when multiple qualify', () => {
    const a = makeSubscription({ status: 'active', renewalDate: '2024-06-18', reminderDate: TODAY })
    const b = makeSubscription({ status: 'active', renewalDate: '2024-06-04', reminderDate: '2024-06-01' })
    expect(scanDueReminders([a, b], prefs)).toHaveLength(2)
  })
})
