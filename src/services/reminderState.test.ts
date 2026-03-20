import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getReminderState, getReminderSummary } from './reminderService'
import { makeSubscription, makePreferences } from '../test/factories'

// TODAY       = 2024-06-15
// RENEWAL     = 2024-06-18  (3 days out → reminderDate === TODAY with leadDays=3)
// RENEWAL_FAR = 2024-07-15  (30 days out → upcoming)
// RENEWAL_PAST= 2024-06-10  (5 days ago  → overdue)
const TODAY        = '2024-06-15'
const RENEWAL      = '2024-06-18'
const RENEWAL_FAR  = '2024-07-15'
const RENEWAL_PAST = '2024-06-10'
const SNOOZE_FUTURE = '2024-06-20'
const SNOOZE_PAST   = '2024-06-10'

const basePrefs = makePreferences({ notificationsEnabled: true, reminderLeadDays: 3 })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── getReminderState ──────────────────────────────────────────────────────────

describe('getReminderState', () => {
  describe('upcoming', () => {
    it('returns upcoming when reminder date is in the future', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL_FAR })
      expect(getReminderState(sub, basePrefs)).toBe('upcoming')
    })

    it('returns upcoming when reminderDate field is explicitly in the future', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL_FAR, reminderDate: '2024-06-20' })
      expect(getReminderState(sub, basePrefs)).toBe('upcoming')
    })

    it('returns upcoming when no renewalDate is set', () => {
      const sub = makeSubscription({ status: 'active' })
      expect(getReminderState(sub, basePrefs)).toBe('upcoming')
    })

    it('uses trialEndDate as fallback when no renewalDate', () => {
      const sub = makeSubscription({ status: 'active', trialEndDate: RENEWAL_FAR })
      expect(getReminderState(sub, basePrefs)).toBe('upcoming')
    })

    it('prefers renewalDate over trialEndDate for due date', () => {
      // renewalDate today+3 → due_today; trialEndDate far future alone would be upcoming
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, trialEndDate: RENEWAL_FAR })
      expect(getReminderState(sub, basePrefs)).toBe('due_today')
    })
  })

  describe('due_today', () => {
    it('returns due_today when computed reminderDate lands on today', () => {
      // renewalDate = today+3, leadDays = 3 → reminderDate = today
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL })
      expect(getReminderState(sub, basePrefs)).toBe('due_today')
    })

    it('returns due_today when reminderDate field is explicitly today', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, reminderDate: TODAY })
      expect(getReminderState(sub, basePrefs)).toBe('due_today')
    })
  })

  describe('overdue', () => {
    it('returns overdue when reminderDate passed but billing date has not', () => {
      // reminderDate 3 days ago, renewalDate tomorrow
      const sub = makeSubscription({ status: 'active', renewalDate: '2024-06-16', reminderDate: '2024-06-12' })
      expect(getReminderState(sub, basePrefs)).toBe('overdue')
    })

    it('returns overdue when the renewal date itself has passed', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL_PAST })
      expect(getReminderState(sub, basePrefs)).toBe('overdue')
    })

    it('returns overdue when renewal date is today (renewal-day reminder)', () => {
      // renewalDate = today → reminderDate = today-3 → reminderDate < today → overdue
      const sub = makeSubscription({ status: 'active', renewalDate: TODAY })
      expect(getReminderState(sub, basePrefs)).toBe('overdue')
    })
  })

  describe('snoozed', () => {
    it('returns snoozed when snoozedUntil is in the future', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, snoozedUntil: SNOOZE_FUTURE })
      expect(getReminderState(sub, basePrefs)).toBe('snoozed')
    })

    it('does not return snoozed when snoozedUntil has expired', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, snoozedUntil: SNOOZE_PAST })
      expect(getReminderState(sub, basePrefs)).not.toBe('snoozed')
    })

    it('snoozed takes priority over overdue', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL_PAST, snoozedUntil: SNOOZE_FUTURE })
      expect(getReminderState(sub, basePrefs)).toBe('snoozed')
    })

    it('snoozed takes priority over due_today', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, snoozedUntil: SNOOZE_FUTURE })
      expect(getReminderState(sub, basePrefs)).toBe('snoozed')
    })

    it('dismiss sets snoozedUntil = renewalDate; snooze expires on renewal day and fires', () => {
      // Simulate dismiss: snoozedUntil = renewalDate
      // On the renewal day itself, isDateReached(renewalDate) = true → snooze expired
      vi.setSystemTime(new Date(`${RENEWAL}T12:00:00Z`)) // advance to renewal day
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, snoozedUntil: RENEWAL })
      expect(getReminderState(sub, basePrefs)).toBe('overdue') // snooze expired, reminder fires
    })
  })
})

// ─── getReminderSummary ────────────────────────────────────────────────────────

describe('getReminderSummary', () => {
  it('returns null when no renewalDate', () => {
    const sub = makeSubscription({ status: 'active' })
    expect(getReminderSummary(sub, basePrefs)).toBeNull()
  })

  it('returns correct subscriptionId', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL })
    expect(getReminderSummary(sub, basePrefs)?.subscriptionId).toBe(sub.id)
  })

  it('returns the computed state', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL })
    expect(getReminderSummary(sub, basePrefs)?.state).toBe('due_today')
  })

  it('populates dueDate from renewalDate', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL })
    expect(getReminderSummary(sub, basePrefs)?.dueDate).toBe(RENEWAL)
  })

  it('calculates daysUntilDue for a future renewal', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL })
    expect(getReminderSummary(sub, basePrefs)?.daysUntilDue).toBe(3)
  })

  it('calculates negative daysUntilDue when renewal has passed', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL_PAST })
    expect(getReminderSummary(sub, basePrefs)?.daysUntilDue).toBe(-5)
  })

  it('calculates daysUntilDue = 0 when renewal is today', () => {
    const sub = makeSubscription({ status: 'active', renewalDate: TODAY })
    expect(getReminderSummary(sub, basePrefs)?.daysUntilDue).toBe(0)
  })

  describe('isFreeTrial', () => {
    it('true when isFreeTrial is set', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL, isFreeTrial: true })
      expect(getReminderSummary(sub, basePrefs)?.isFreeTrial).toBe(true)
    })

    it('false when isFreeTrial is undefined', () => {
      const sub = makeSubscription({ status: 'active', renewalDate: RENEWAL })
      expect(getReminderSummary(sub, basePrefs)?.isFreeTrial).toBe(false)
    })
  })
})
