import { describe, it, expect } from 'vitest'
import { groupByIntent } from './statusService'
import { makeSubscription } from '../test/factories'

describe('groupByIntent', () => {
  it('returns empty groups for empty array', () => {
    const result = groupByIntent([])
    expect(result.cancel).toHaveLength(0)
    expect(result.renew).toHaveLength(0)
    expect(result.remindBeforeBilling).toHaveLength(0)
  })

  it('groups cancel intent correctly', () => {
    const sub = makeSubscription({ intent: 'cancel' })
    const result = groupByIntent([sub])
    expect(result.cancel).toHaveLength(1)
    expect(result.cancel[0].id).toBe(sub.id)
  })

  it('groups renew intent correctly', () => {
    const sub = makeSubscription({ intent: 'renew' })
    const result = groupByIntent([sub])
    expect(result.renew).toHaveLength(1)
    expect(result.renew[0].id).toBe(sub.id)
  })

  it('groups remind_before_billing intent correctly', () => {
    const sub = makeSubscription({ intent: 'remind_before_billing' })
    const result = groupByIntent([sub])
    expect(result.remindBeforeBilling).toHaveLength(1)
    expect(result.remindBeforeBilling[0].id).toBe(sub.id)
  })

  it('skips archived subscriptions', () => {
    const sub = makeSubscription({ intent: 'cancel', status: 'archived' })
    const result = groupByIntent([sub])
    expect(result.cancel).toHaveLength(0)
  })

  it('skips canceled subscriptions', () => {
    const sub = makeSubscription({ intent: 'renew', status: 'canceled' })
    const result = groupByIntent([sub])
    expect(result.renew).toHaveLength(0)
  })

  it('handles mixed intents and statuses', () => {
    const subs = [
      makeSubscription({ intent: 'cancel', status: 'active' }),
      makeSubscription({ intent: 'renew', status: 'active' }),
      makeSubscription({ intent: 'remind_before_billing', status: 'active' }),
      makeSubscription({ intent: 'cancel', status: 'archived' }),
      makeSubscription({ intent: 'renew', status: 'canceled' }),
    ]
    const result = groupByIntent(subs)
    expect(result.cancel).toHaveLength(1)
    expect(result.renew).toHaveLength(1)
    expect(result.remindBeforeBilling).toHaveLength(1)
  })

  it('returns counts matching total active subscriptions', () => {
    const subs = [
      makeSubscription({ intent: 'cancel' }),
      makeSubscription({ intent: 'cancel' }),
      makeSubscription({ intent: 'renew' }),
    ]
    const result = groupByIntent(subs)
    const total = result.cancel.length + result.renew.length + result.remindBeforeBilling.length
    expect(total).toBe(3)
  })
})
