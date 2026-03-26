import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { DetectionResult } from '../types/subscription'
import TrackPrompt from '../popup/TrackPrompt'
import popupStyles from '../popup/popup.css?inline'
import { Radio as RadioIcon, X as XIcon } from 'lucide-react'

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
            <div className="popup-logo-mark">
              <RadioIcon size={16} />
            </div>
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

  // Inter font for shadow DOM context — host page won't have it
  const font = document.createElement('style')
  font.textContent = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`
  shadow.appendChild(font)

  // Inject popup.css into shadow
  const style = document.createElement('style')
  style.textContent = popupStyles
  shadow.appendChild(style)

  // Base styles: reset, animation, font/color inheritance via CSS vars
  const anim = document.createElement('style')
  anim.textContent = `
    :host { all: initial; display: contents; }
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

  function teardown() {
    keepAlivePort.disconnect()
    root.unmount()
    host.remove()
  }

  const root = createRoot(mountContainer)
  root.render(<OverlayShell result={result} onClose={teardown} />)
}
