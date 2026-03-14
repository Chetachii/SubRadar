export type ReminderType = 'renewal_warning' | 'trial_end_warning'

export type ReminderStatus = 'pending' | 'sent' | 'snoozed' | 'completed'

export interface ReminderEvent {
  subscriptionId: string
  dueDate: string
  reminderDate: string
  type: ReminderType
  deliveredAt?: string
  status: ReminderStatus
}
