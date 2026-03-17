import { useState } from 'react'
import type { DetectionResult, Intent } from '../types/subscription'
import { RefreshCw as RefreshCwIcon, Bell as BellIcon, Ban as BanIcon, CircleHelp as CircleHelpIcon, Pin as PinIcon } from 'lucide-react'

interface Props {
  result: DetectionResult
  onSaved: () => void
  onDismiss: () => void
}

const INTENT_OPTIONS = [
  { value: 'renew_automatically',      label: 'Renew automatically',      icon: <RefreshCwIcon size={16} />, key: 'renew'     },
  { value: 'remind_before_billing',    label: 'Remind me before billing', icon: <BellIcon size={16} />,      key: 'remind'    },
  { value: 'cancel_before_trial_ends', label: 'Cancel before trial ends', icon: <BanIcon size={16} />,       key: 'cancel'    },
  { value: 'undecided',                label: 'Undecided',                icon: <CircleHelpIcon size={16} />,key: 'undecided' },
] as const

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
    <>
      <div className="popup-body">
        <p className="track-detected-banner">
          Detected subscription on <strong>{result.sourceDomain}</strong>
        </p>

        <div className="form-section">
          <div className="form-field">
            <label className="form-label">Service name</label>
            <input
              className={`form-input${error && !serviceName.trim() ? ' form-input--error' : ''}`}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Netflix"
              autoFocus
            />
            {error && <p className="form-error-msg">{error}</p>}
          </div>
        </div>

        <div className="form-section">
          <p className="form-section-title">What do you want to do?</p>
          <div className="intent-grid">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={[
                  'intent-option',
                  `intent-option--${opt.key}`,
                  intent === opt.value ? 'intent-option--selected' : '',
                ].join(' ')}
                onClick={() => setIntent(opt.value as Intent)}
              >
                <span className="intent-icon" aria-hidden="true">{opt.icon}</span>
                <span className="intent-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="popup-footer">
        <div className="popup-footer-row">
          <button className="btn-dismiss" onClick={onDismiss}>Dismiss</button>
          <button className="btn-submit" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><PinIcon size={14} aria-hidden="true" /> Track it</>}
          </button>
        </div>
      </div>
    </>
  )
}
