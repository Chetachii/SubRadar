import { describe, it, expect, beforeEach } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { getPreferences, updatePreferences, DEFAULT_PREFERENCES } from './preferencesRepository'

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
})

describe('getPreferences', () => {
  it('returns defaults when storage is empty', async () => {
    const prefs = await getPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns stored preferences merged with defaults', async () => {
    await updatePreferences({ reminderLeadDays: 7 })
    const prefs = await getPreferences()
    expect(prefs.reminderLeadDays).toBe(7)
    expect(prefs.notificationsEnabled).toBe(DEFAULT_PREFERENCES.notificationsEnabled)
  })
})

describe('updatePreferences', () => {
  it('updates a single field', async () => {
    const updated = await updatePreferences({ notificationsEnabled: false })
    expect(updated.notificationsEnabled).toBe(false)
    expect(updated.reminderLeadDays).toBe(DEFAULT_PREFERENCES.reminderLeadDays)
  })

  it('persists the update', async () => {
    await updatePreferences({ defaultSort: 'name' })
    const prefs = await getPreferences()
    expect(prefs.defaultSort).toBe('name')
  })

  it('merges partial updates without losing other fields', async () => {
    await updatePreferences({ reminderLeadDays: 5 })
    await updatePreferences({ notificationsEnabled: false })
    const prefs = await getPreferences()
    expect(prefs.reminderLeadDays).toBe(5)
    expect(prefs.notificationsEnabled).toBe(false)
  })
})
