import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { makePreferences } from '../test/factories'

const { state, authMock } = vi.hoisted(() => {
  const state: { rows: Record<string, unknown>[]; counter: number } = { rows: [], counter: 0 }
  const authMock = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-uuid' } }, error: null }),
  }
  return { state, authMock }
})

vi.mock('../lib/supabase', () => {
  function makeChain() {
    let insertData: Record<string, unknown> | null = null
    let updateData: Record<string, unknown> | null = null
    let isDelete = false
    let eqField: string | null = null
    let eqValue: unknown = null

    const chain: Record<string, unknown> = {
      select() { return chain },
      order() { return chain },
      insert(data: Record<string, unknown>) { insertData = data; return chain },
      update(data: Record<string, unknown>) { updateData = data; return chain },
      delete() { isDelete = true; return chain },
      eq(field: string, value: unknown) { eqField = field; eqValue = value; return chain },

      async maybeSingle() {
        const row = state.rows.find((r) => r[eqField!] === eqValue) ?? null
        return { data: row, error: null }
      },

      async single() {
        if (insertData) {
          const row: Record<string, unknown> = {
            id: `uuid-${++state.counter}`,
            ...insertData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          state.rows.push(row)
          return { data: row, error: null }
        }
        if (updateData && eqField) {
          const idx = state.rows.findIndex((r) => r[eqField!] === eqValue)
          if (idx === -1) return { data: null, error: { message: 'Not found' } }
          state.rows[idx] = { ...state.rows[idx], ...updateData, updated_at: new Date().toISOString() }
          return { data: state.rows[idx], error: null }
        }
        return { data: null, error: null }
      },

      then(resolve: (r: unknown) => unknown, reject?: (e: unknown) => unknown) {
        if (isDelete) {
          if (eqField) {
            const idx = state.rows.findIndex((r) => r[eqField!] === eqValue)
            if (idx !== -1) state.rows.splice(idx, 1)
          }
          return Promise.resolve({ error: null }).then(resolve as () => unknown, reject)
        }
        let rows = [...state.rows]
        if (eqField) rows = rows.filter((r) => r[eqField!] === eqValue)
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
      },
    }
    return chain
  }

  return {
    supabase: {
      from: (_table: string) => makeChain(),
      auth: authMock,
    },
  }
})
import {
  createSubscription,
  updateSubscription,
  archiveSubscription,
  markRenewed,
  setSnooze,
} from './subscriptionService'
import { listSubscriptions, getSubscriptionById, deleteSubscription } from '../repository/subscriptionRepository'
import { scanDueReminders } from './reminderService'
import { findDuplicate } from './duplicateService'

const prefs = makePreferences({ reminderLeadDays: 3, notificationsEnabled: true })
const TODAY = '2024-06-15'

const createdIds: string[] = []

beforeEach(() => {
  createdIds.length = 0
  installChromeMock()
  resetChromeMock()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
})

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(createdIds.map((id) => deleteSubscription(id).catch(() => {})))
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
    createdIds.push(created.id)
    expect(created.id).toBeDefined()
    expect(created.status).toBe('active')
    expect(created.serviceName).toBe('Spotify')

    // Read — scope to this test's sub to isolate from DB noise
    const allSubs = await listSubscriptions()
    const ourSub = allSubs.find((s) => s.id === created.id)
    expect(ourSub).toBeDefined()

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
    const created = await createSubscription(
      {
        serviceName: 'Netflix',
        intent: 'cancel',
        detectionSource: 'manual_entry',
        renewalDate: '2024-06-18', // 3 days from today → reminderDate = June 15 = today
      },
      prefs,
    )
    createdIds.push(created.id)

    const subs = await listSubscriptions()
    const due = scanDueReminders(subs, prefs)
    const ourDue = due.filter((s) => s.id === created.id)
    expect(ourDue).toHaveLength(1)
    expect(ourDue[0].serviceName).toBe('Netflix')
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
    createdIds.push(created.id)

    await setSnooze(created.id, '2024-06-20')

    const subs = await listSubscriptions()
    const due = scanDueReminders(subs, prefs)
    const ourDue = due.filter((s) => s.id === created.id)
    expect(ourDue).toHaveLength(0)
  })
})

describe('duplicate detection prevents double-save', () => {
  it('findDuplicate finds existing active subscription', async () => {
    const created = await createSubscription(
      {
        serviceName: 'Hulu',
        intent: 'cancel',
        detectionSource: 'auto_detected',
        sourceDomain: 'hulu.com',
      },
      prefs,
    )
    createdIds.push(created.id)

    const subs = await listSubscriptions()
    const ourSubs = subs.filter((s) => createdIds.includes(s.id))
    const duplicate = findDuplicate(ourSubs, 'Hulu', 'hulu.com')
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
    createdIds.push(sub.id)

    await archiveSubscription(sub.id)
    const subs = await listSubscriptions()
    const ourSubs = subs.filter((s) => createdIds.includes(s.id))
    const duplicate = findDuplicate(ourSubs, 'Hulu')
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
    createdIds.push(created.id)

    await markRenewed(created.id)

    const sub = await getSubscriptionById(created.id)
    expect(sub!.renewalDate).toBe('2024-07-15')
    expect(sub!.lastReminderSentAt).toBe(TODAY)
  })
})
