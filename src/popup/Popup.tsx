import { useState } from 'react'
import { useFavicon } from '../utils/faviconCache'
import ManualEntryForm from './ManualEntryForm'
import type { BillingFrequency, Subscription } from '../types/subscription'
import { CheckCircle as CheckCircleIcon, X as XIcon, Bell as BellIcon } from 'lucide-react'
import { daysBetween } from '../utils/dates'
import { formatCurrency } from '../utils/currency'
import './popup.css'

function ServiceAvatar({ serviceName, sourceDomain }: { serviceName: string; sourceDomain?: string }) {
  const favicon = useFavicon(sourceDomain)
  return (
    <div className={`success-avatar${favicon ? ' success-avatar--favicon' : ''}`} aria-hidden="true">
      {favicon
        ? <img src={favicon} alt="" />
        : serviceName.charAt(0).toUpperCase()
      }
    </div>
  )
}

function formatBillingFrequency(freq: BillingFrequency | undefined): string {
  switch (freq) {
    case 'monthly': return '/ mo'
    case 'yearly': return '/ yr'
    case 'weekly': return '/ wk'
    case 'quarterly': return '/ qtr'
    case 'one_time': return ' one-time'
    default: return ''
  }
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildReminderCopy(sub: Subscription): string {
  if (!sub.renewalDate) return ''
  const renewalStr = formatDate(sub.renewalDate)
  if (!sub.reminderDate || sub.reminderDate === sub.renewalDate) {
    return `We'll remind you on the renewal day (${renewalStr}).`
  }
  const lead = daysBetween(sub.reminderDate, sub.renewalDate)
  const reminderStr = formatDate(sub.reminderDate)
  return `We'll remind you ${lead} day${lead === 1 ? '' : 's'} before renewal (${reminderStr}) and on the renewal day (${renewalStr}).`
}

export default function Popup() {
  const [formKey, setFormKey] = useState(0)
  const [savedSub, setSavedSub] = useState<Subscription | null>(null)

  function handleSaved(sub: Subscription) {
    setSavedSub(sub)
  }

  function handleAddAnother() {
    setSavedSub(null)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="popup">
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

      {savedSub ? (
        <>
          <div className="popup-body popup-body--airy">
            <div className="success-view">
              <div className="success-icon"><CheckCircleIcon size={28} aria-hidden="true" /></div>
              <p className="success-title">Subscription tracked!</p>
              <div className="success-details">
                <ServiceAvatar serviceName={savedSub.serviceName} sourceDomain={savedSub.sourceDomain} />
                <p className="success-service">{savedSub.serviceName}</p>
                {savedSub.cost != null && (
                  <p className="success-cost">
                    {formatCurrency(savedSub.cost, savedSub.currency)}{formatBillingFrequency(savedSub.billingFrequency)}
                  </p>
                )}
                {savedSub.renewalDate && (
                  <div className="success-details-meta">
                    <span className="success-renewal-badge">
                      Renews {formatDate(savedSub.renewalDate)}
                    </span>
                    <p className="success-remind">
                      <BellIcon size={11} aria-hidden="true" />
                      {buildReminderCopy(savedSub)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="popup-footer popup-footer--airy">
            <div className="popup-footer-row popup-footer-row--airy">
              <button type="button" className="btn-dismiss btn-dismiss--airy" onClick={handleAddAnother}>Add another</button>
              <button
                className="btn-submit btn-submit--airy"
                onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') })}
              >
                View Dashboard
              </button>
            </div>
          </div>
        </>
      ) : (
        <ManualEntryForm key={formKey} onSaved={handleSaved} />
      )}
    </div>
  )
}
