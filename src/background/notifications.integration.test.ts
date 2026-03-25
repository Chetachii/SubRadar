/**
 * Integration tests for runScan using the real reminderService logic.
 * No mock for reminderService — eligibility is computed end-to-end.
 * Only repos and subscriptionService side-effects are mocked to avoid storage I/O.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { makeSubscription, makePreferences } from '../test/factories'

vi.mock('../repository/subscriptionRepository', () => ({
  listSubscriptions: vi.fn(),
}))

vi.mock('../repository/preferencesRepository', () => ({
  getPreferences: vi.fn(),
}))

vi.mock('../services/subscriptionService', () => ({
  stampReminderSent: vi.fn(),
  rollRenewalDate: vi.fn(),
}))

// NOTE: reminderService is NOT mocked — real eligibility logic runs end-to-end

import { runScan } from './notifications'
import * as subRepo from '../repository/subscriptionRepository'
import * as prefsRepo from '../repository/preferencesRepository'
import * as subService from '../services/subscriptionService'

const TODAY = '2024-06-15'
const prefs = makePreferences({ notificationsEnabled: true, reminderLeadDays: 3 })

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  vi.mocked(prefsRepo.getPreferences).mockResolvedValue(prefs)
  vi.mocked(subService.stampReminderSent).mockResolvedValue(makeSubscription())
  vi.mocked(subService.rollRenewalDate).mockResolvedValue(makeSubscription())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('runScan — real eligibility (integration)', () => {
  it('fires renewal_day notification when renewalDate = today', async () => {
    const sub = makeSubscription({ id: 'sub-today', renewalDate: TODAY })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      'subradar-sub-today-renewal',
      expect.objectContaining({ type: 'basic' }),
    )
  })

  it('fires early notification when renewalDate = today + 3 (T-3 boundary)', async () => {
    const sub = makeSubscription({ id: 'sub-early', renewalDate: '2024-06-18' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      'subradar-sub-early-early',
      expect.objectContaining({ type: 'basic' }),
    )
  })

  it('does not fire when renewalDate is 5 days out (outside T-3 window)', async () => {
    // renewalDate = today + 5 → reminderDate = today + 2 → not yet reached
    const sub = makeSubscription({ id: 'sub-future', renewalDate: '2024-06-20' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('does not fire when snoozedUntil is in the future', async () => {
    const sub = makeSubscription({
      id: 'sub-snoozed',
      renewalDate: TODAY,
      snoozedUntil: '2024-06-20',
    })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('does not fire when lastReminderSentAt = today (renewal_day dedup)', async () => {
    const sub = makeSubscription({
      id: 'sub-dedup',
      renewalDate: TODAY,
      lastReminderSentAt: TODAY,
    })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('fires renewal_day when lastReminderSentAt is from prior cycle (T-3 stamp does not block)', async () => {
    // early fired on 2024-06-12 (T-3), now on renewal day → renewal_day unblocked
    const sub = makeSubscription({
      id: 'sub-prior',
      renewalDate: TODAY,
      reminderDate: '2024-06-12',
      lastReminderSentAt: '2024-06-12',
    })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      'subradar-sub-prior-renewal',
      expect.any(Object),
    )
  })

  it('does not fire for archived subscription', async () => {
    const sub = makeSubscription({ id: 'sub-archived', renewalDate: TODAY, status: 'archived' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('does not fire when notifications are disabled in prefs', async () => {
    const sub = makeSubscription({ id: 'sub-disabled', renewalDate: TODAY })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(
      makePreferences({ notificationsEnabled: false }),
    )

    await runScan()

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('calls rollRenewalDate (not stampReminderSent) for renewal_day point', async () => {
    const sub = makeSubscription({ id: 'sub-roll', renewalDate: TODAY, billingFrequency: 'monthly' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(subService.rollRenewalDate).toHaveBeenCalledWith('sub-roll', expect.any(Object))
    expect(subService.stampReminderSent).not.toHaveBeenCalled()
  })

  it('calls stampReminderSent (not rollRenewalDate) for early point', async () => {
    const sub = makeSubscription({ id: 'sub-stamp', renewalDate: '2024-06-18' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    expect(subService.stampReminderSent).toHaveBeenCalledWith('sub-stamp')
    expect(subService.rollRenewalDate).not.toHaveBeenCalled()
  })

  it('notification message includes "today" for renewal_day point', async () => {
    const sub = makeSubscription({ id: 'sub-msg', renewalDate: TODAY, intent: 'cancel' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    const [, opts] = vi.mocked(chrome.notifications.create).mock.calls[0]
    expect((opts as chrome.notifications.NotificationOptions).message).toContain('today')
  })

  it('notification message includes days remaining for early point', async () => {
    const sub = makeSubscription({ id: 'sub-days', renewalDate: '2024-06-18' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])

    await runScan()

    const [, opts] = vi.mocked(chrome.notifications.create).mock.calls[0]
    expect((opts as chrome.notifications.NotificationOptions).message).toContain('3 days')
  })
})
