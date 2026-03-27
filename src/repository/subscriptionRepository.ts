import { supabase } from '../lib/supabase'
import type { Subscription } from '../types/subscription'

// Map DB row (snake_case) → TS Subscription (camelCase)
function fromRow(row: Record<string, unknown>): Subscription {
  return {
    id: row.id as string,
    serviceName: row.service_name as string,
    sourceDomain: row.source_domain as string | undefined,
    subscriptionDate: row.subscription_date as string | undefined,
    trialEndDate: row.trial_end_date as string | undefined,
    renewalDate: row.renewal_date as string | undefined,
    reminderDate: row.reminder_date as string | undefined,
    cost: row.cost as number | undefined,
    currency: row.currency as string | undefined,
    billingFrequency: row.billing_frequency as Subscription['billingFrequency'],
    isFreeTrial: row.is_free_trial as boolean | undefined,
    intent: row.intent as Subscription['intent'],
    status: row.status as Subscription['status'],
    notes: row.notes as string | undefined,
    detectionSource: row.detection_source as Subscription['detectionSource'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    snoozedUntil: row.snoozed_until as string | undefined,
    lastReminderSentAt: row.last_reminder_sent_at as string | undefined,
  }
}

// Map partial TS Subscription → DB row (snake_case, only defined fields)
function toRow(sub: Partial<Subscription>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (sub.serviceName !== undefined) row.service_name = sub.serviceName
  if (sub.sourceDomain !== undefined) row.source_domain = sub.sourceDomain
  if (sub.subscriptionDate !== undefined) row.subscription_date = sub.subscriptionDate
  if (sub.trialEndDate !== undefined) row.trial_end_date = sub.trialEndDate
  if (sub.renewalDate !== undefined) row.renewal_date = sub.renewalDate
  if (sub.reminderDate !== undefined) row.reminder_date = sub.reminderDate
  if (sub.cost !== undefined) row.cost = sub.cost
  if (sub.currency !== undefined) row.currency = sub.currency
  if (sub.billingFrequency !== undefined) row.billing_frequency = sub.billingFrequency
  if (sub.isFreeTrial !== undefined) row.is_free_trial = sub.isFreeTrial
  if (sub.intent !== undefined) row.intent = sub.intent
  if (sub.status !== undefined) row.status = sub.status
  if (sub.notes !== undefined) row.notes = sub.notes
  if (sub.detectionSource !== undefined) row.detection_source = sub.detectionSource
  if (sub.snoozedUntil !== undefined) row.snoozed_until = sub.snoozedUntil
  if (sub.lastReminderSentAt !== undefined) row.last_reminder_sent_at = sub.lastReminderSentAt
  return row
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

export async function createSubscription(
  input: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Subscription> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...toRow(input), user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription> {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(toRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return fromRow(data)
}

export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from('subscriptions').delete().eq('id', id)
  if (error) throw error
}
