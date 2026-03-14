import { setupDailyAlarm, handleAlarm } from './alarms'
import { handleNotificationButtonClick, runScan } from './notifications'
import { registerMessageRouter } from './messageRouter'

// Register message router
registerMessageRouter()

// Register alarm listener
chrome.alarms.onAlarm.addListener(handleAlarm)

// Register notification button click handler
chrome.notifications.onButtonClicked.addListener(handleNotificationButtonClick)

// On install: set up alarm and run initial scan
chrome.runtime.onInstalled.addListener(() => {
  setupDailyAlarm()
  runScan()
  console.log('[SubRadar] Extension installed. Alarm and scan initialized.')
})

// On startup: ensure alarm is registered
chrome.runtime.onStartup.addListener(() => {
  setupDailyAlarm()
})
