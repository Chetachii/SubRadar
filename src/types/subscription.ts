export type BillingFrequency = 'one_time' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'

export type Intent = 'cancel' | 'renew' | 'remind_before_billing'

export type SubscriptionStatus = 'active' | 'archived' | 'canceled'

export interface Subscription {
  id: string
  serviceName: string
  sourceDomain?: string
  isFreeTrial?: boolean
  subscriptionDate?: string
  trialEndDate?: string
  renewalDate?: string
  reminderDate?: string
  cost?: number
  currency?: string
  billingFrequency?: BillingFrequency
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
