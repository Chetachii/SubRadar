import { setupDailyAlarm, handleAlarm } from './alarms'
import { handleNotificationButtonClick, runScan } from './notifications'
import { registerMessageRouter } from './messageRouter'

// Register message router
registerMessageRouter()

// Keep the service worker alive while any popup/overlay port is open
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup-keepalive' || port.name === 'overlay-keepalive') {
    port.onDisconnect.addListener(() => {})
  }
})

// Register alarm listener
chrome.alarms.onAlarm.addListener(handleAlarm)

// Register notification button click handler
chrome.notifications.onButtonClicked.addListener(handleNotificationButtonClick)

// Clicking the notification body opens the dashboard
chrome.notifications.onClicked.addListener((notifId) => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })
  chrome.notifications.clear(notifId)
})

// On install: set up alarm and run initial scan
chrome.runtime.onInstalled.addListener(() => {
  setupDailyAlarm()
  runScan()
})

// On startup: ensure alarm is registered
chrome.runtime.onStartup.addListener(() => {
  setupDailyAlarm()
})
