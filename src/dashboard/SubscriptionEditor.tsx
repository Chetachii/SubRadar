import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { Subscription, Intent } from '../types/subscription'
import { X as XIcon, ChevronDown as ChevronDownIcon } from 'lucide-react'
import { CURRENCIES } from '../utils/currency'

interface Props {
  subscription: Subscription
  onSave: () => void
  onClose: () => void
}

const INTENT_OPTIONS: { value: Intent; label: string; desc: string }[] = [
  {
    value: 'cancel',
    label: 'Cancel',
    desc: 'You already plan to cancel this before the next charge. We will send you a reminder 3 days before the renewal date.',
  },
  {
    value: 'renew',
    label: 'Renew',
    desc: 'You want to keep this subscription and let it continue. This is a heads-up that charge is expected.',
  },
  {
    value: 'remind_before_billing',
    label: 'Remind Before Billing',
    desc: 'You want a reminder so you can decide later.',
  },
]


export default function SubscriptionEditor({ subscription: sub, onSave, onClose }: Props) {
  const [serviceName, setServiceName] = useState(sub.serviceName)
  const [intent, setIntent] = useState<Intent>(sub.intent)
  const [trialEndDate, setTrialEndDate] = useState(sub.trialEndDate ?? '')
  const [renewalDate, setRenewalDate] = useState(sub.renewalDate ?? '')
  const [cost, setCost] = useState(sub.cost?.toString() ?? '')
  const [currency, setCurrency] = useState(
    CURRENCIES.find((c) => c.code === sub.currency) ? (sub.currency ?? 'USD') : 'USD'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Animate out then call onClose
  const dismiss = useCallback(() => {
    if (closing) return
    setClosing(true)
    const t = setTimeout(onClose, 180)
    return () => clearTimeout(t)
  }, [closing, onClose])

  // Click outside: check mousedown target against panel
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        dismiss()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [dismiss])

  // Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dismiss])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  async function handleSave() {
    if (!serviceName.trim()) { setError('Service name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SUBSCRIPTION',
        payload: {
          id: sub.id,
          patch: {
            serviceName: serviceName.trim(),
            intent,
            trialEndDate: trialEndDate || undefined,
            renewalDate: renewalDate || undefined,
            cost: cost ? parseFloat(cost) : undefined,
            currency,
          },
        },
      })
      if (response?.error) throw new Error(response.error)
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const selectedIntentDesc = INTENT_OPTIONS.find((o) => o.value === intent)?.desc

  return createPortal(
    <div className={`modal-overlay${closing ? ' modal-overlay--closing' : ''}`}>
      <div
        className={`modal-panel${closing ? ' modal-panel--closing' : ''}`}
        ref={panelRef}
        role="dialog"
        aria-label="Edit subscription"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3 className="modal-heading">Edit subscription</h3>
          <button type="button" className="modal-close" onClick={dismiss} aria-label="Close">
            <XIcon size={18} aria-hidden="true" />
          </button>
        </div>

        <label className="form-label">Service name</label>
        <input className="form-input" value={serviceName} onChange={(e) => setServiceName(e.target.value)} />

        <label className="form-label">Intent</label>
        <select className="form-input form-input--select" value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
          {INTENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {selectedIntentDesc && <p className="form-hint">{selectedIntentDesc}</p>}

        <label className="form-label">Trial end date</label>
        <input className="form-input" type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />

        <label className="form-label">Renewal date</label>
        <input className="form-input" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />

        <label className="form-label">Cost</label>
        <div className="form-input-prefix-wrap">
          <div className="form-currency-wrap">
            <select
              className="form-currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              aria-label="Currency"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
              ))}
            </select>
            <span className="form-currency-chevron" aria-hidden="true"><ChevronDownIcon size={12} /></span>
          </div>
          <input className="form-input form-input--with-currency" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button className="btn btn--secondary btn--lg" onClick={dismiss}>Cancel</button>
          <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
