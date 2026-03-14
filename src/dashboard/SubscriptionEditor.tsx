import { useState } from 'react'
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
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.heading}>Edit subscription</h3>

        <label style={styles.label}>Service name</label>
        <input style={styles.input} value={serviceName} onChange={(e) => setServiceName(e.target.value)} />

        <label style={styles.label}>Intent</label>
        <select style={styles.input} value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
          {INTENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label style={styles.label}>Trial end date</label>
        <input style={styles.input} type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />

        <label style={styles.label}>Renewal date</label>
        <input style={styles.input} type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />

        <label style={styles.label}>Cost</label>
        <input style={styles.input} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />

        <label style={styles.label}>Billing frequency</label>
        <select style={styles.input} value={billingFrequency} onChange={(e) => setBillingFrequency(e.target.value as BillingFrequency)}>
          {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <label style={styles.label}>Cancellation URL</label>
        <input style={styles.input} value={cancellationUrl} onChange={(e) => setCancellationUrl(e.target.value)} placeholder="https://..." />

        <label style={styles.label}>Notes</label>
        <textarea style={{ ...styles.input, minHeight: '60px', resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.actions}>
          <button style={styles.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#fff', borderRadius: '10px', padding: '24px', width: '400px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' },
  heading: { margin: '0 0 16px', fontSize: '17px', fontWeight: 700 },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#374151' },
  input: { display: 'block', width: '100%', padding: '6px 8px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  error: { color: '#dc2626', fontSize: '12px', marginBottom: '8px' },
  actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '14px' },
  btnSecondary: { background: 'transparent', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 18px', cursor: 'pointer', fontSize: '14px' },
}
