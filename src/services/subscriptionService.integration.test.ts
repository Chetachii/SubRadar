import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { makePreferences } from '../test/factories'
import {
  createSubscription,
  updateSubscription,
  archiveSubscription,
  markRenewed,
  setSnooze,
} from './subscriptionService'
import { listSubscriptions, getSubscriptionById } from '../repository/subscriptionRepository'
import { scanDueReminders } from './reminderService'
import { findDuplicate } from './duplicateService'

const prefs = makePreferences({ reminderLeadDays: 3, notificationsEnabled: true })
const TODAY = '2024-06-15'

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('full subscription lifecycle', () => {
  it('create → read → update → archive', async () => {
    // Create
    const created = await createSubscription(
      {
        serviceName: 'Spotify',
        intent: 'cancel',
        detectionSource: 'manual_entry',
        renewalDate: '2024-07-01',
      },
      prefs,
    )
    expect(created.id).toBeDefined()
    expect(created.status).toBe('active')
    expect(created.serviceName).toBe('Spotify')

    // Read
    const allSubs = await listSubscriptions()
    expect(allSubs).toHaveLength(1)
    expect(allSubs[0].id).toBe(created.id)

    // Update — patch must include required fields (serviceName, intent) since validator runs on patch
    const updated = await updateSubscription(
      created.id,
      { serviceName: created.serviceName, intent: created.intent, cost: 9.99 },
      prefs,
    )
    expect(updated.cost).toBe(9.99)
    const fetched = await getSubscriptionById(created.id)
    expect(fetched!.cost).toBe(9.99)

    // Archive
    await archiveSubscription(created.id)
    const final = await getSubscriptionById(created.id)
    expect(final!.status).toBe('archived')
  })
})

describe('reminder scan end-to-end', () => {
  it('eligible subscription appears in scan results', async () => {
    await createSubscription(
      {
        serviceName: 'Netflix',
        intent: 'cancel',
        detectionSource: 'manual_entry',
        renewalDate: '2024-06-18', // 3 days from today → reminderDate = June 15 = today
      },
      prefs,
    )

    const subs = await listSubscriptions()
    const due = scanDueReminders(subs, prefs)
    expect(due).toHaveLength(1)
    expect(due[0].serviceName).toBe('Netflix')
  })

  it('snoozed subscription does not appear in scan', async () => {
    const created = await createSubscription(
      {
        serviceName: 'Netflix',
        intent: 'cancel',
        detectionSource: 'manual_entry',
        renewalDate: '2024-06-18',
      },
      prefs,
    )

    await setSnooze(created.id, '2024-06-20')

    const subs = await listSubscriptions()
    const due = scanDueReminders(subs, prefs)
    expect(due).toHaveLength(0)
  })
})

describe('duplicate detection prevents double-save', () => {
  it('findDuplicate finds existing active subscription', async () => {
    await createSubscription(
      {
        serviceName: 'Hulu',
        intent: 'cancel',
        detectionSource: 'auto_detected',
        sourceDomain: 'hulu.com',
      },
      prefs,
    )

    const subs = await listSubscriptions()
    const duplicate = findDuplicate(subs, 'Hulu', 'hulu.com')
    expect(duplicate).not.toBeNull()
    expect(duplicate!.serviceName).toBe('Hulu')
  })

  it('archived subscription is not returned as duplicate', async () => {
    const sub = await createSubscription(
      {
        serviceName: 'Hulu',
        intent: 'cancel',
        detectionSource: 'auto_detected',
      },
      prefs,
    )

    await archiveSubscription(sub.id)
    const subs = await listSubscriptions()
    const duplicate = findDuplicate(subs, 'Hulu')
    expect(duplicate).toBeNull()
  })
})

describe('markRenewed resets reminder state', () => {
  it('advances renewalDate for monthly subscription', async () => {
    const created = await createSubscription(
      {
        serviceName: 'Spotify',
        intent: 'renew',
        detectionSource: 'manual_entry',
        renewalDate: TODAY,
        billingFrequency: 'monthly',
      },
      prefs,
    )

    await markRenewed(created.id)

    const sub = await getSubscriptionById(created.id)
    expect(sub!.renewalDate).toBe('2024-07-15')
    expect(sub!.lastReminderSentAt).toBe(TODAY)
  })
})
