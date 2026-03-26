import { useState } from 'react'
import ManualEntryForm from './ManualEntryForm'
import type { Subscription } from '../types/subscription'
import { Radio as RadioIcon, CheckCircle as CheckCircleIcon, X as XIcon, Bell as BellIcon } from 'lucide-react'
import './popup.css'

type View = 'manual_entry' | 'success'

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Popup() {
  const [view, setView] = useState<View>('manual_entry')
  const [formKey, setFormKey] = useState(0)
  const [savedSub, setSavedSub] = useState<Subscription | null>(null)

  function handleSaved(sub: Subscription) {
    setSavedSub(sub)
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
          <div className="popup-header-actions">
            <button
              className="btn-text-link btn-text-link--header"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })}
            >
              View Dashboard
            </button>
            <button className="popup-close" onClick={() => window.close()} aria-label="Close">
              <XIcon size={15} />
            </button>
          </div>
        </div>
        <div className="success-view">
          <div className="success-icon"><CheckCircleIcon size={28} aria-hidden="true" /></div>
          <p className="success-title">Subscription tracked!</p>
          {savedSub && (
            <div className="success-details">
              <div className="success-avatar" aria-hidden="true">
                {savedSub.serviceName.charAt(0).toUpperCase()}
              </div>
              <p className="success-service">{savedSub.serviceName}</p>
              {savedSub.renewalDate && (
                <div className="success-details-meta">
                  <span className="success-renewal-badge">
                    Renews {formatDate(savedSub.renewalDate)}
                  </span>
                  <p className="success-remind">
                    <BellIcon size={11} aria-hidden="true" />
                    {savedSub.reminderDate && savedSub.reminderDate !== savedSub.renewalDate
                      ? `We'll remind you on ${formatDate(savedSub.reminderDate)} and ${formatDate(savedSub.renewalDate)}`
                      : `We'll remind you on ${formatDate(savedSub.renewalDate)}`}
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="success-actions">
            <button className="btn btn--ghost btn--sm" onClick={() => { setFormKey((k) => k + 1); setSavedSub(null); setView('manual_entry') }}>
              Add another subscription
            </button>
          </div>
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
        <div className="popup-header-actions">
          <button
            type="button"
            className="btn-text-link btn-text-link--header"
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })}
          >
            View Dashboard
          </button>
          <button type="button" className="popup-close" onClick={() => window.close()} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
      </div>

      <ManualEntryForm key={formKey} onSaved={handleSaved} />
    </div>
  )
}
