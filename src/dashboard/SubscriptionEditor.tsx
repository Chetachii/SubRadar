import { useState, useEffect, useRef } from 'react'
import type { Subscription, Intent } from '../types/subscription'
import { updateSubscription } from '../services/subscriptionService'
import { getPreferences } from '../repository/preferencesRepository'

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
  const [cancellationUrl, setCancellationUrl] = useState(sub.cancellationUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleSave() {
    if (!serviceName.trim()) { setError('Service name is required.'); return }
    setSaving(true)
    setError(null)
    try {
      const prefs = await getPreferences()
      await updateSubscription(sub.id, {
        serviceName: serviceName.trim(),
        intent,
        trialEndDate: trialEndDate || undefined,
        renewalDate: renewalDate || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        cancellationUrl: cancellationUrl || undefined,
      }, prefs)
      onSave()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const selectedIntentDesc = INTENT_OPTIONS.find((o) => o.value === intent)?.desc

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel" ref={panelRef} role="dialog" aria-label="Edit subscription">
        <h3 className="modal-heading">Edit subscription</h3>

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
          <span className="form-input-currency">{sub.currency === 'GBP' ? '£' : sub.currency === 'EUR' ? '€' : '$'}</span>
          <input className="form-input form-input--with-currency" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>

        <label className="form-label">Cancellation URL <span className="form-label-optional">(optional)</span></label>
        <input className="form-input" value={cancellationUrl} onChange={(e) => setCancellationUrl(e.target.value)} placeholder="https://..." />

        {error && <p className="form-error">{error}</p>}

        <div className="form-actions">
          <button className="btn btn--secondary btn--lg" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary btn--lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
