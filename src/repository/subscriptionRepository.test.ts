import { describe, it, expect, beforeEach, vi } from 'vitest'

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
  listSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from './subscriptionRepository'

beforeEach(() => {
  state.rows.length = 0
  state.counter = 0
  authMock.getUser.mockResolvedValue({ data: { user: { id: 'test-user-uuid' } }, error: null })
})

describe('listSubscriptions', () => {
  it('returns empty array when storage is empty', async () => {
    const result = await listSubscriptions()
    expect(result).toEqual([])
  })

  it('returns stored subscriptions', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    const result = await listSubscriptions()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(sub.id)
  })
})

describe('getSubscriptionById', () => {
  it('returns null when not found', async () => {
    const result = await getSubscriptionById('nonexistent')
    expect(result).toBeNull()
  })

  it('returns the subscription when found', async () => {
    const sub = await createSubscription({
      serviceName: 'Spotify',
      intent: 'renew',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    const result = await getSubscriptionById(sub.id)
    expect(result).not.toBeNull()
    expect(result!.serviceName).toBe('Spotify')
  })
})

describe('createSubscription', () => {
  it('creates with auto-generated id', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    expect(sub.id).toBeDefined()
    expect(typeof sub.id).toBe('string')
  })

  it('sets createdAt and updatedAt', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    expect(sub.createdAt).toBeDefined()
    expect(sub.updatedAt).toBeDefined()
  })

  it('persists to storage', async () => {
    await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    const subs = await listSubscriptions()
    expect(subs).toHaveLength(1)
  })

  it('includes user_id in insert', async () => {
    await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    expect(state.rows[0].user_id).toBe('test-user-uuid')
  })

  it('throws Not authenticated when user is null', async () => {
    authMock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(
      createSubscription({ serviceName: 'Netflix', intent: 'cancel', status: 'active', detectionSource: 'manual_entry' }),
    ).rejects.toThrow('Not authenticated')
  })
})

describe('updateSubscription', () => {
  it('updates the specified fields', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    const updated = await updateSubscription(sub.id, { cost: 15.99 })
    expect(updated.cost).toBe(15.99)
    expect(updated.serviceName).toBe('Netflix')
  })

  it('updates the updatedAt timestamp', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    const updated = await updateSubscription(sub.id, { cost: 10 })
    expect(updated.updatedAt).toBeDefined()
  })

  it('persists the update', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    await updateSubscription(sub.id, { status: 'archived' })
    const fetched = await getSubscriptionById(sub.id)
    expect(fetched!.status).toBe('archived')
  })
})

describe('deleteSubscription', () => {
  it('removes the subscription', async () => {
    const sub = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    await deleteSubscription(sub.id)
    const subs = await listSubscriptions()
    expect(subs).toHaveLength(0)
  })

  it('does not affect other subscriptions', async () => {
    const a = await createSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    const b = await createSubscription({
      serviceName: 'Spotify',
      intent: 'renew',
      status: 'active',
      detectionSource: 'manual_entry',
    })
    await deleteSubscription(a.id)
    const subs = await listSubscriptions()
    expect(subs).toHaveLength(1)
    expect(subs[0].id).toBe(b.id)
  })
})
