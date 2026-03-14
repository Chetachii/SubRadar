import { useState } from 'react'
import type { DetectionResult, Intent } from '../types/subscription'

interface Props {
  result: DetectionResult
  onSaved: () => void
  onDismiss: () => void
}

const INTENT_OPTIONS: { value: Intent; label: string }[] = [
  { value: 'cancel_before_trial_ends', label: 'Cancel before trial ends' },
  { value: 'remind_before_billing', label: 'Remind me before billing' },
  { value: 'renew_automatically', label: 'Let it renew automatically' },
  { value: 'undecided', label: 'Undecided' },
]

export default function TrackPrompt({ result, onSaved, onDismiss }: Props) {
  const [serviceName, setServiceName] = useState(result.serviceName ?? '')
  const [intent, setIntent] = useState<Intent>('cancel_before_trial_ends')
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
        detectionSource: 'auto_detected' as const,
        sourceDomain: result.sourceDomain,
        cost: result.price,
        currency: result.currency,
        billingFrequency: result.billingFrequency,
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
      <p style={styles.label}>Detected subscription on <strong>{result.sourceDomain}</strong></p>

      <label style={styles.fieldLabel}>Service name</label>
      <input
        style={styles.input}
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
        placeholder="e.g. Netflix"
      />

      <label style={styles.fieldLabel}>Your intent</label>
      <select style={styles.input} value={intent} onChange={(e) => setIntent(e.target.value as Intent)}>
        {INTENT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <button style={styles.btnSecondary} onClick={onDismiss}>Dismiss</button>
        <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Track it'}
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  label: { fontSize: '13px', color: '#64748b', margin: '0 0 12px' },
  fieldLabel: { display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#374151' },
  input: { display: 'block', width: '100%', padding: '6px 8px', marginBottom: '12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  error: { color: '#dc2626', fontSize: '12px', marginBottom: '8px' },
  actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end' },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' },
  btnSecondary: { background: 'transparent', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' },
}
