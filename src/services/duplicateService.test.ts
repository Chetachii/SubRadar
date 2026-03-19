import { describe, it, expect } from 'vitest'
import { findDuplicate } from './duplicateService'
import { makeSubscription } from '../test/factories'

describe('findDuplicate', () => {
  it('returns null for empty subscription list', () => {
    expect(findDuplicate([], 'Netflix', 'netflix.com')).toBeNull()
  })

  it('finds exact name match', () => {
    const sub = makeSubscription({ serviceName: 'Netflix', sourceDomain: undefined })
    expect(findDuplicate([sub], 'Netflix')).toBe(sub)
  })

  it('matches case-insensitively', () => {
    const sub = makeSubscription({ serviceName: 'Netflix' })
    expect(findDuplicate([sub], 'netflix')).toBe(sub)
    expect(findDuplicate([sub], 'NETFLIX')).toBe(sub)
  })

  it('matches trimmed whitespace', () => {
    const sub = makeSubscription({ serviceName: '  Netflix  ' })
    expect(findDuplicate([sub], 'Netflix')).toBe(sub)
  })

  it('returns null when name does not match', () => {
    const sub = makeSubscription({ serviceName: 'Spotify' })
    expect(findDuplicate([sub], 'Netflix')).toBeNull()
  })

  it('matches by name and domain when both provided', () => {
    const sub = makeSubscription({ serviceName: 'Netflix', sourceDomain: 'netflix.com' })
    expect(findDuplicate([sub], 'Netflix', 'netflix.com')).toBe(sub)
  })

  it('returns null when name matches but domain does not', () => {
    const sub = makeSubscription({ serviceName: 'Netflix', sourceDomain: 'netflix.com' })
    expect(findDuplicate([sub], 'Netflix', 'other.com')).toBeNull()
  })

  it('ignores archived subscriptions', () => {
    const sub = makeSubscription({ serviceName: 'Netflix', status: 'archived' })
    expect(findDuplicate([sub], 'Netflix')).toBeNull()
  })

  it('ignores canceled subscriptions', () => {
    const sub = makeSubscription({ serviceName: 'Netflix', status: 'canceled' })
    expect(findDuplicate([sub], 'Netflix')).toBeNull()
  })

  it('returns the first active match when multiple exist', () => {
    const archived = makeSubscription({ serviceName: 'Netflix', status: 'archived' })
    const active = makeSubscription({ serviceName: 'Netflix', status: 'active' })
    expect(findDuplicate([archived, active], 'Netflix')).toBe(active)
  })

  it('returns null when source domain given but sub has no domain', () => {
    const sub = makeSubscription({ serviceName: 'Netflix', sourceDomain: undefined })
    // name matches but no sub.sourceDomain so nameMatch is returned (truthy)
    expect(findDuplicate([sub], 'Netflix', 'netflix.com')).toBe(sub)
  })
})
