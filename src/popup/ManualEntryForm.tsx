import { useState } from 'react'
import type { Intent } from '../types/subscription'

interface Props {
  onSaved: () => void
}

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: 'cancel_before_trial_ends', label: 'Cancel before trial ends' },
  { value: 'remind_before_billing', label: 'Remind me before billing' },
  { value: 'renew_automatically', label: 'Let it renew automatically' },
  { value: 'undecided', label: 'Undecided' },
]

export default function ManualEntryForm({ onSaved }: Props) {
  const [serviceName, setServiceName] = useState('')
  const [intent, setIntent] = useState<Intent>('cancel_before_trial_ends')
  const [trialEndDate, setTrialEndDate] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [cost, setCost] = useState('')
  const [cancellationUrl, setCancellationUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!serviceName.trim()) {
      setError('Service name is required.')
      return
    }
    setSaving(true)
    setError(null)

    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SUBSCRIPTION',
      payload: {
        serviceName: serviceName.trim(),
        intent,
        detectionSource: 'manual_entry' as const,
        trialEndDate: trialEndDate || undefined,
        renewalDate: renewalDate || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        cancellationUrl: cancellationUrl || undefined,
        notes: notes || undefined,
      },
    })

    setSaving(false)
    if (response?.ok) {
      onSaved()
    } else {
      setError(response?.error ?? 'Something went wrong.')
    }
  }

  return (
    <div>
      <label style={styles.fieldLabel}>Service name *</label>
      <input style={styles.input} value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="e.g. Spotify" />

      <label style={styles.fieldLabel}>Intent</label>
      <select style={styles.input} value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
        {INTENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <label style={styles.fieldLabel}>Trial end date</label>
      <input style={styles.input} type="date" value={trialEndDate} onChange={(e) => setTrialEndDate(e.target.value)} />

      <label style={styles.fieldLabel}>Renewal date</label>
      <input style={styles.input} type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />

      <label style={styles.fieldLabel}>Cost (optional)</label>
      <input style={styles.input} type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="9.99" />

      <label style={styles.fieldLabel}>Cancellation URL (optional)</label>
      <input style={styles.input} value={cancellationUrl} onChange={(e) => setCancellationUrl(e.target.value)} placeholder="https://..." />

      <label style={styles.fieldLabel}>Notes (optional)</label>
      <textarea style={{ ...styles.input, resize: 'vertical', minHeight: '60px' }} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p style={styles.error}>{error}</p>}

      <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Track subscription'}
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  fieldLabel: { display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#374151' },
  input: { display: 'block', width: '100%', padding: '6px 8px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  error: { color: '#dc2626', fontSize: '12px', marginBottom: '8px' },
  btnPrimary: { width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
}
