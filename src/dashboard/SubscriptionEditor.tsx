import { useState, useEffect, useRef } from 'react'
import type { Subscription, Intent, BillingFrequency } from '../types/subscription'
import { updateSubscription } from '../services/subscriptionService'
import { getPreferences } from '../repository/preferencesRepository'

interface Props {
  subscription: Subscription
  onSave: () => void
  onClose: () => void
}

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: 'cancel_before_trial_ends', label: 'Cancel before trial ends' },
  { value: 'remind_before_billing', label: 'Remind me before billing' },
  { value: 'renew_automatically', label: 'Let it renew automatically' },
  { value: 'undecided', label: 'Undecided' },
]

const FREQUENCY_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one_time', label: 'One-time' },
  { value: 'unknown', label: 'Unknown' },
]

export default function SubscriptionEditor({ subscription: sub, onSave, onClose }: Props) {
  const [serviceName, setServiceName] = useState(sub.serviceName)
  const [intent, setIntent] = useState<Intent>(sub.intent)
  const [trialEndDate, setTrialEndDate] = useState(sub.trialEndDate ?? '')
  const [renewalDate, setRenewalDate] = useState(sub.renewalDate ?? '')
  const [cost, setCost] = useState(sub.cost?.toString() ?? '')
  const [billingFrequency, setBillingFrequency] = useState<BillingFrequency>(sub.billingFrequency ?? 'monthly')
  const [cancellationUrl, setCancellationUrl] = useState(sub.cancellationUrl ?? '')
  const [notes, setNotes] = useState(sub.notes ?? '')
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
        billingFrequency,
        cancellationUrl: cancellationUrl || undefined,
        notes: notes || undefined,
      }, prefs)
      onSave()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel" ref={panelRef} role="dialog" aria-label="Edit subscription">
        <h3 className="modal-heading">Edit subscription</h3>

        <label className="form-label">Service name</label>
        <input className="form-input" value={serviceName} onChange={(e) => setServiceName(e.target.value)} />

        <label className="form-label">Intent</label>
        <select className="form-input" value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
          {INTENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label className="form-label">Trial end date</label>
        <input className="form-input" type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />

        <label className="form-label">Renewal date</label>
        <input className="form-input" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />

        <label className="form-label">Cost</label>
        <input className="form-input" type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />

        <label className="form-label">Billing frequency</label>
        <select className="form-input" value={billingFrequency} onChange={(e) => setBillingFrequency(e.target.value as BillingFrequency)}>
          {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label className="form-label">Cancellation URL</label>
        <input className="form-input" value={cancellationUrl} onChange={(e) => setCancellationUrl(e.target.value)} placeholder="https://..." />

        <label className="form-label">Notes</label>
        <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />

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
