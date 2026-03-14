export type BillingFrequency = 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'

export type Intent =
  | 'renew_automatically'
  | 'remind_before_billing'
  | 'cancel_before_trial_ends'
  | 'undecided'

export type SubscriptionStatus = 'active' | 'cancel_soon' | 'renew_soon' | 'archived' | 'canceled'

export interface Subscription {
  id: string
  serviceName: string
  sourceDomain?: string
  subscriptionDate?: string
  trialEndDate?: string
  renewalDate?: string
  reminderDate?: string
  cost?: number
  currency?: string
  billingFrequency?: BillingFrequency
  cancellationUrl?: string
  intent: Intent
  status: SubscriptionStatus
  notes?: string
  detectionSource: 'auto_detected' | 'manual_entry'
  createdAt: string
  updatedAt: string
  snoozedUntil?: string
  lastReminderSentAt?: string
}

export interface DetectionResult {
  pageUrl: string
  sourceDomain: string
  confidenceScore: number
  serviceName?: string
  price?: number
  currency?: string
  billingFrequency?: string
  trialDurationDays?: number
  detectedRenewalDate?: string
  matchedSignals: string[]
}
