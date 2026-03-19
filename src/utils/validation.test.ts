import { describe, it, expect } from 'vitest'
import { validateSubscription } from './validation'

describe('validateSubscription', () => {
  it('returns no errors for a valid subscription', () => {
    const errors = validateSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      renewalDate: '2024-12-31',
      cost: 9.99,
    })
    expect(errors).toHaveLength(0)
  })

  it('requires serviceName', () => {
    const errors = validateSubscription({ intent: 'cancel' })
    expect(errors).toContain('Service name is required.')
  })

  it('rejects empty serviceName', () => {
    const errors = validateSubscription({ serviceName: '', intent: 'cancel' })
    expect(errors).toContain('Service name is required.')
  })

  it('rejects whitespace-only serviceName', () => {
    const errors = validateSubscription({ serviceName: '   ', intent: 'cancel' })
    expect(errors).toContain('Service name is required.')
  })

  it('requires intent', () => {
    const errors = validateSubscription({ serviceName: 'Netflix' })
    expect(errors).toContain('Intent is required.')
  })

  it('rejects invalid date format for renewalDate', () => {
    const errors = validateSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      renewalDate: 'not-a-date',
    })
    expect(errors).toContain('renewalDate must be a valid date (YYYY-MM-DD).')
  })

  it('rejects invalid date format for trialEndDate', () => {
    const errors = validateSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      trialEndDate: '15/06/2024',
    })
    expect(errors).toContain('trialEndDate must be a valid date (YYYY-MM-DD).')
  })

  it('rejects negative cost', () => {
    const errors = validateSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      cost: -5,
    })
    expect(errors).toContain('Cost must be a non-negative number.')
  })

  it('rejects NaN cost', () => {
    const errors = validateSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      cost: NaN,
    })
    expect(errors).toContain('Cost must be a non-negative number.')
  })

  it('accepts zero cost', () => {
    const errors = validateSubscription({
      serviceName: 'Netflix',
      intent: 'cancel',
      cost: 0,
    })
    expect(errors).not.toContain('Cost must be a non-negative number.')
  })

  it('accumulates multiple errors', () => {
    const errors = validateSubscription({ cost: -1 })
    expect(errors.length).toBeGreaterThanOrEqual(2)
  })

  it('accepts valid optional date fields', () => {
    const errors = validateSubscription({
      serviceName: 'Spotify',
      intent: 'renew',
      subscriptionDate: '2024-01-01',
      trialEndDate: '2024-02-01',
      renewalDate: '2024-03-01',
    })
    expect(errors).toHaveLength(0)
  })
})
