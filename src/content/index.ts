import { runDetection } from './detector'
import { hasBeenPrompted, markPrompted } from './promptState'
import { mountOverlay } from './overlay'

function tryDetect(): void {
  const url = window.location.href
  if (hasBeenPrompted(url)) return
  const result = runDetection()
  if (!result) return
  markPrompted(url)
  mountOverlay(result)
}

function scheduleRetries(): void {
  // Staggered retries for JS-heavy pages (e.g. Next.js, React apps)
  setTimeout(() => tryDetect(), 1500)
  setTimeout(() => tryDetect(), 3500)
  setTimeout(() => tryDetect(), 7000)
}

function main(): void {
  tryDetect()
  scheduleRetries()
}

// SPA navigation support — re-run detection when the URL changes via pushState
const _pushState = history.pushState.bind(history)
history.pushState = function (...args) {
  _pushState(...args)
  setTimeout(() => { tryDetect(); scheduleRetries() }, 100)
}
window.addEventListener('popstate', () => {
  setTimeout(() => { tryDetect(); scheduleRetries() }, 100)
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main)
} else {
  main()
}
