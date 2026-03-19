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

function main(): void {
  // First attempt immediately (works for server-rendered pages)
  tryDetect()

  // Second attempt after SPA frameworks have had time to render content
  setTimeout(() => {
    tryDetect()
  }, 1500)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main)
} else {
  main()
}
