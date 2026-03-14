import { runDetection } from './detector'
import { hasBeenPrompted, markPrompted } from './promptState'

function handleDetection(): void {
  const url = window.location.href

  if (hasBeenPrompted(url)) return

  const result = runDetection()
  if (!result) return

  markPrompted(url)

  chrome.runtime.sendMessage({ type: 'DETECTION_FOUND', payload: result }).catch((err) => {
    console.warn('[SubRadar] Could not send detection result:', err)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleDetection)
} else {
  handleDetection()
}
