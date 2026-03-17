import { useEffect, useState } from 'react'
import type { DetectionResult } from '../types/subscription'
import TrackPrompt from './TrackPrompt'
import ManualEntryForm from './ManualEntryForm'
import { Radio as RadioIcon, CheckCircle as CheckCircleIcon } from 'lucide-react'
import './popup.css'

type View = 'loading' | 'track_prompt' | 'manual_entry' | 'success'

export default function Popup() {
  const [view, setView] = useState<View>('loading')
  const [detection, setDetection] = useState<DetectionResult | null>(null)

  useEffect(() => {
    chrome.storage.session.get('pendingDetection', (result) => {
      const pending = result['pendingDetection'] as DetectionResult | undefined
      if (pending) {
        setDetection(pending)
        setView('track_prompt')
      } else {
        setView('manual_entry')
      }
    })
  }, [])

  function handleSaved() {
    chrome.storage.session.remove('pendingDetection')
    setView('success')
  }

  function handleDismiss() {
    chrome.storage.session.remove('pendingDetection')
    setView('manual_entry')
  }

  if (view === 'loading') {
    return (
      <div className="popup">
        <div className="popup-header">
          <div className="popup-logo">
            <div className="popup-logo-mark"><RadioIcon size={16} aria-hidden="true" /></div>
            <span className="popup-title">SubRadar</span>
          </div>
        </div>
        <div className="popup-body" style={{ color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (view === 'success') {
    return (
      <div className="popup">
        <div className="popup-header">
          <div className="popup-logo">
            <div className="popup-logo-mark"><RadioIcon size={16} aria-hidden="true" /></div>
            <span className="popup-title">SubRadar</span>
          </div>
        </div>
        <div className="success-view">
          <div className="success-icon"><CheckCircleIcon size={28} aria-hidden="true" /></div>
          <p className="success-title">Subscription tracked!</p>
          <p className="success-sub">It will appear in your dashboard.</p>
          <button className="btn-text-link" onClick={() => setView('manual_entry')}>
            Track another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="popup">
      <div className="popup-header">
        <div className="popup-logo">
          <div className="popup-logo-mark"><RadioIcon size={16} aria-hidden="true" /></div>
          <span className="popup-title">SubRadar</span>
        </div>
      </div>

      {view === 'track_prompt' && detection ? (
        <TrackPrompt result={detection} onSaved={handleSaved} onDismiss={handleDismiss} />
      ) : (
        <ManualEntryForm onSaved={handleSaved} />
      )}
    </div>
  )
}
