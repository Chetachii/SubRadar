import { describe, it, expect, beforeEach } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import {
  listSubscriptions,
  getSubscriptionById,
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from './subscriptionRepository'

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
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
