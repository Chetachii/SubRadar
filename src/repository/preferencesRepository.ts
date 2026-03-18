import type { Preferences } from '../types/preferences'

const STORAGE_KEY = 'preferences'

export const DEFAULT_PREFERENCES: Preferences = {
  notificationsEnabled: true,
  reminderLeadDays: 3,
  promptCooldownHours: 24,
  defaultSort: 'renewal_date',
}

export async function getPreferences(): Promise<Preferences> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return { ...DEFAULT_PREFERENCES, ...(result[STORAGE_KEY] as Partial<Preferences> ?? {}) }
}

export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const current = await getPreferences()
  const updated = { ...current, ...patch }
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
  return updated
}
