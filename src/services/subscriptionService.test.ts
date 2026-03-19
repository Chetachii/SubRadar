import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSubscription,
  updateSubscription,
  archiveSubscription,
  cancelSubscription,
  markRenewed,
  setSnooze,
} from './subscriptionService'
import { makeSubscription, makePreferences } from '../test/factories'

vi.mock('../repository/subscriptionRepository', () => ({
  listSubscriptions: vi.fn(),
  getSubscriptionById: vi.fn(),
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
}))

import * as repo from '../repository/subscriptionRepository'

const prefs = makePreferences()

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSubscription', () => {
  it('creates a subscription with status active', async () => {
    const expected = makeSubscription({ serviceName: 'Netflix', status: 'active' })
    vi.mocked(repo.createSubscription).mockResolvedValue(expected)

    const result = await createSubscription(
      { serviceName: 'Netflix', intent: 'cancel', detectionSource: 'manual_entry' },
      prefs,
    )

    expect(repo.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'Netflix', status: 'active' }),
    )
    expect(result).toEqual(expected)
  })

  it('trims serviceName whitespace', async () => {
    const expected = makeSubscription()
    vi.mocked(repo.createSubscription).mockResolvedValue(expected)

    await createSubscription(
      { serviceName: '  Netflix  ', intent: 'cancel', detectionSource: 'manual_entry' },
      prefs,
    )

    expect(repo.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: 'Netflix' }),
    )
  })

  it('computes reminderDate from renewalDate and leadDays', async () => {
    const expected = makeSubscription({ reminderDate: '2024-06-12' })
    vi.mocked(repo.createSubscription).mockResolvedValue(expected)

    await createSubscription(
      {
        serviceName: 'Spotify',
        intent: 'cancel',
        detectionSource: 'manual_entry',
        renewalDate: '2024-06-15',
      },
      makePreferences({ reminderLeadDays: 3 }),
    )

    expect(repo.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ reminderDate: '2024-06-12' }),
    )
  })

  it('throws when serviceName is empty', async () => {
    await expect(
      createSubscription({ serviceName: '', intent: 'cancel', detectionSource: 'manual_entry' }, prefs),
    ).rejects.toThrow('Service name is required.')
  })

  it('throws when intent is missing', async () => {
    await expect(
      createSubscription(
        { serviceName: 'Netflix', intent: undefined as never, detectionSource: 'manual_entry' },
        prefs,
      ),
    ).rejects.toThrow('Intent is required.')
  })

  it('uses provided reminderDate over computed one', async () => {
    const expected = makeSubscription({ reminderDate: '2024-06-01' })
    vi.mocked(repo.createSubscription).mockResolvedValue(expected)

    await createSubscription(
      {
        serviceName: 'Netflix',
        intent: 'cancel',
        detectionSource: 'manual_entry',
        renewalDate: '2024-06-15',
        reminderDate: '2024-06-01',
      },
      prefs,
    )

    expect(repo.createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ reminderDate: '2024-06-01' }),
    )
  })
})

describe('updateSubscription', () => {
  it('updates an existing subscription', async () => {
    const existing = makeSubscription({ id: 'abc', cost: 5 })
    const updated = { ...existing, cost: 15 }
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(existing)
    vi.mocked(repo.updateSubscription).mockResolvedValue(updated)

    // patch must include required fields (serviceName, intent) since validator runs on patch
    const result = await updateSubscription(
      'abc',
      { serviceName: 'TestService', intent: 'cancel', cost: 15 },
      prefs,
    )
    expect(result.cost).toBe(15)
  })

  it('throws when subscription not found', async () => {
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(null)
    await expect(
      updateSubscription('missing', { serviceName: 'Netflix', intent: 'cancel', cost: 10 }, prefs),
    ).rejects.toThrow('Subscription not found: missing')
  })

  it('throws on invalid patch data', async () => {
    await expect(
      updateSubscription('abc', { serviceName: 'Netflix', intent: 'cancel', cost: -1 }, prefs),
    ).rejects.toThrow('Cost must be a non-negative number.')
  })
})

describe('archiveSubscription', () => {
  it('sets status to archived', async () => {
    const archived = makeSubscription({ status: 'archived' })
    vi.mocked(repo.updateSubscription).mockResolvedValue(archived)

    const result = await archiveSubscription('abc')
    expect(repo.updateSubscription).toHaveBeenCalledWith('abc', { status: 'archived' })
    expect(result.status).toBe('archived')
  })
})

describe('cancelSubscription', () => {
  it('sets status to canceled', async () => {
    const canceled = makeSubscription({ status: 'canceled' })
    vi.mocked(repo.updateSubscription).mockResolvedValue(canceled)

    const result = await cancelSubscription('abc')
    expect(repo.updateSubscription).toHaveBeenCalledWith('abc', { status: 'canceled' })
    expect(result.status).toBe('canceled')
  })
})

describe('markRenewed', () => {
  it('throws when subscription not found', async () => {
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(null)
    await expect(markRenewed('missing')).rejects.toThrow('Subscription not found: missing')
  })

  it('computes next renewal date for monthly billing', async () => {
    const sub = makeSubscription({ renewalDate: '2024-06-15', billingFrequency: 'monthly' })
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(sub)
    vi.mocked(repo.updateSubscription).mockResolvedValue({ ...sub, renewalDate: '2024-07-15' })

    await markRenewed(sub.id)
    expect(repo.updateSubscription).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ renewalDate: '2024-07-15' }),
    )
  })

  it('computes next renewal date for yearly billing', async () => {
    // 2024 is a leap year: Jan 1 + 365 days = Dec 31, 2024
    const sub = makeSubscription({ renewalDate: '2024-01-01', billingFrequency: 'yearly' })
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(sub)
    vi.mocked(repo.updateSubscription).mockResolvedValue({ ...sub, renewalDate: '2024-12-31' })

    await markRenewed(sub.id)
    expect(repo.updateSubscription).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ renewalDate: '2024-12-31' }),
    )
  })

  it('leaves renewalDate undefined for one_time billing', async () => {
    const sub = makeSubscription({ renewalDate: '2024-06-15', billingFrequency: 'one_time' })
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(sub)
    vi.mocked(repo.updateSubscription).mockResolvedValue(sub)

    await markRenewed(sub.id)
    expect(repo.updateSubscription).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ renewalDate: undefined }),
    )
  })

  it('sets status to active', async () => {
    const sub = makeSubscription({ billingFrequency: 'monthly', renewalDate: '2024-06-15' })
    vi.mocked(repo.getSubscriptionById).mockResolvedValue(sub)
    vi.mocked(repo.updateSubscription).mockResolvedValue({ ...sub, status: 'active' })

    await markRenewed(sub.id)
    expect(repo.updateSubscription).toHaveBeenCalledWith(
      sub.id,
      expect.objectContaining({ status: 'active' }),
    )
  })
})

describe('setSnooze', () => {
  it('sets snoozedUntil', async () => {
    const snoozed = makeSubscription({ snoozedUntil: '2024-06-20' })
    vi.mocked(repo.updateSubscription).mockResolvedValue(snoozed)

    const result = await setSnooze('abc', '2024-06-20')
    expect(repo.updateSubscription).toHaveBeenCalledWith('abc', { snoozedUntil: '2024-06-20' })
    expect(result.snoozedUntil).toBe('2024-06-20')
  })
})
