import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installChromeMock, resetChromeMock, alarmStore } from '../test/chromeMock'

vi.mock('./notifications', () => ({
  runScan: vi.fn(),
}))

import { setupDailyAlarm, handleAlarm, ALARM_NAME } from './alarms'
import * as notifications from './notifications'

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
  vi.clearAllMocks()
})

describe('ALARM_NAME', () => {
  it('is DAILY_REMINDER_SCAN', () => {
    expect(ALARM_NAME).toBe('DAILY_REMINDER_SCAN')
  })
})

describe('setupDailyAlarm', () => {
  it('creates alarm when none exists', () => {
    setupDailyAlarm()
    expect(chrome.alarms.create).toHaveBeenCalledWith(ALARM_NAME, { periodInMinutes: 1440 })
  })

  it('does not create alarm when one already exists', () => {
    // Pre-populate the alarm store so get() finds it
    alarmStore.set(ALARM_NAME, {
      name: ALARM_NAME,
      scheduledTime: Date.now(),
      periodInMinutes: 1440,
    })
    setupDailyAlarm()
    expect(chrome.alarms.create).not.toHaveBeenCalled()
  })
})

describe('handleAlarm', () => {
  it('calls runScan when alarm name matches', () => {
    vi.mocked(notifications.runScan).mockResolvedValue(undefined)
    handleAlarm({ name: ALARM_NAME, scheduledTime: Date.now() })
    expect(notifications.runScan).toHaveBeenCalled()
  })

  it('does not call runScan for unrelated alarm', () => {
    handleAlarm({ name: 'other-alarm', scheduledTime: Date.now() })
    expect(notifications.runScan).not.toHaveBeenCalled()
  })
})
