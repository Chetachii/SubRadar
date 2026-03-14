import type { Subscription } from './subscription'

export interface Preferences {
  notificationsEnabled: boolean
  reminderLeadDays: number
  promptCooldownHours: number
  defaultSort: 'renewal_date' | 'created_at' | 'name'
}

export interface RuntimeMeta {
  lastReminderScanAt?: string
  dismissedPages?: Record<string, string>
}

export interface StorageLayout {
  subscriptions: Subscription[]
  preferences: Preferences
  runtimeMeta: RuntimeMeta
}
