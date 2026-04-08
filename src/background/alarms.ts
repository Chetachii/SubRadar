import { runScan } from './notifications'

export const ALARM_NAME = 'DAILY_REMINDER_SCAN'

export function setupDailyAlarm(): void {
  chrome.alarms.get(ALARM_NAME, (existing) => {
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1440 })
    }
  })
}

export function handleAlarm(alarm: chrome.alarms.Alarm): void {
  if (alarm.name === ALARM_NAME) {
    runScan()
  }
}
