import type { Subscription } from '../types/subscription'
import { isValidISODate } from './dates'

export function validateSubscription(data: Partial<Subscription>): string[] {
  const errors: string[] = []

  if (!data.serviceName || data.serviceName.trim().length === 0) {
    errors.push('Service name is required.')
  }

  if (!data.intent) {
    errors.push('Intent is required.')
  }

  for (const field of ['subscriptionDate', 'trialEndDate', 'renewalDate', 'reminderDate', 'snoozedUntil'] as const) {
    const value = data[field]
    if (value && !isValidISODate(value)) {
      errors.push(`${field} must be a valid date (YYYY-MM-DD).`)
    }
  }

  if (data.cost !== undefined && (isNaN(data.cost) || data.cost < 0)) {
    errors.push('Cost must be a non-negative number.')
  }

  return errors
}
