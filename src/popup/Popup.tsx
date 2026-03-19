import { useState } from 'react'
import ManualEntryForm from './ManualEntryForm'
import { Radio as RadioIcon, CheckCircle as CheckCircleIcon, X as XIcon } from 'lucide-react'
import './popup.css'

type View = 'manual_entry' | 'success'

export default function Popup() {
  const [view, setView] = useState<View>('manual_entry')

  function handleSaved() {
    setView('success')
  }

  if (view === 'success') {
    return (
      <div className="popup">
        <div className="popup-header">
          <div className="popup-logo">
            <div className="popup-logo-mark"><RadioIcon size={16} aria-hidden="true" /></div>
            <span className="popup-title">SubRadar</span>
          </div>
          <button className="popup-close" onClick={() => window.close()} aria-label="Close">
            <XIcon size={15} />
          </button>
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
        <button type="button" className="popup-close" onClick={() => window.close()} aria-label="Close">
          <XIcon size={16} />
        </button>
      </div>

      <ManualEntryForm onSaved={handleSaved} />
    </div>
  )
}
