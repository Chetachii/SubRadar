import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'

let idCounter = 0

export function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  idCounter++
  return {
    id: `sub-${idCounter}`,
    serviceName: 'TestService',
    intent: 'cancel',
    status: 'active',
    detectionSource: 'manual_entry',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makePreferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    notificationsEnabled: true,
    reminderLeadDays: 3,
    promptCooldownHours: 24,
    defaultSort: 'renewal_date',
    ...overrides,
  }
}
