import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { DetectionResult } from '../types/subscription'
import TrackPrompt from '../popup/TrackPrompt'
import popupStyles from '../popup/popup.css?inline'
import { X as XIcon } from 'lucide-react'

interface ShellProps {
  result: DetectionResult
  onClose: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
function OverlayShell({ result, onClose }: ShellProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: '0',
        background: 'var(--color-scrim)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sr-dialog-title"
        style={{
          width: '380px',
          maxHeight: '90vh',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'overlayIn 300ms var(--ease-out-expo) both',
        }}
      >
        <div className="popup-header">
          <div className="popup-logo">
            <svg className="popup-logo-mark" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="0" y="0" width="512" height="512" rx="112" fill="#2563EB" />
              <path d="M256 120 A150 150 0 1 1 106 270 L256 270 Z" fill="white" opacity="0.2" />
              <path d="M256 180 A90 90 0 1 1 166 270 L256 270 Z" fill="white" opacity="0.45" />
              <line x1="256" y1="270" x2="256" y2="110" stroke="white" strokeWidth="16" strokeLinecap="round" />
              <circle cx="256" cy="270" r="20" fill="white" />
              <circle cx="345" cy="170" r="28" fill="#FCD34D" />
            </svg>
            <span className="popup-title" id="sr-dialog-title">SubRadar</span>
          </div>
          <button className="popup-close" onClick={onClose} aria-label="Close">
            <XIcon size={15} />
          </button>
        </div>
        <TrackPrompt result={result} onSaved={onClose} onDismiss={onClose} />
      </div>
    </div>
  )
}

export function mountOverlay(result: DetectionResult) {
  // Keep the background service worker alive while the overlay is open
  const keepAlivePort = chrome.runtime.connect({ name: 'overlay-keepalive' })

  // Host element — sits outside page DOM tree
  const host = document.createElement('div')
  host.id = 'subradar-overlay-host'
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    pointerEvents: 'none',
  })
  document.body.appendChild(host)

  // Shadow root — full CSS isolation
  const shadow = host.attachShadow({ mode: 'closed' })

  // Inter font for shadow DOM — served locally so no Google network request
  const font = document.createElement('style')
  const fontBase = chrome.runtime.getURL('fonts/')
  font.textContent = [400, 500, 600, 700, 800].map((w) => `
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: ${w};
      font-display: swap;
      src: url('${fontBase}inter-latin-${w}-normal.woff2') format('woff2');
    }`).join('')
  shadow.appendChild(font)

  // Inject popup.css into shadow
  const style = document.createElement('style')
  style.textContent = popupStyles
  shadow.appendChild(style)

  // Base styles: reset, animation, font/color inheritance via CSS vars
  const anim = document.createElement('style')
  anim.textContent = `
    :host { all: initial; display: contents; color-scheme: light; }
    * { box-sizing: border-box; }
    #sr-base { color: var(--color-text-primary); font-family: var(--font-body); background: transparent; display: contents; }
    @keyframes overlayIn {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
  `
  shadow.appendChild(anim)

  // React mount container
  const mountContainer = document.createElement('div')
  mountContainer.id = 'sr-base'
  shadow.appendChild(mountContainer)

  let tornDown = false
  function teardown() {
    if (tornDown) return
    tornDown = true
    try { keepAlivePort.disconnect() } catch {}
    root.unmount()
    host.remove()
  }

  const root = createRoot(mountContainer)
  root.render(<OverlayShell result={result} onClose={teardown} />)
}
