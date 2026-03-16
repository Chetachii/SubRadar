import React, { useState } from 'react'
import type { Intent, BillingFrequency } from '../types/subscription'
import { RefreshCwIcon, BellIcon, BanIcon, CircleHelpIcon, PinIcon, AlertCircleIcon, ChevronRightIcon } from '../components/icons'

interface Props {
  onSaved: () => void
}

interface FormState {
  serviceName: string
  price: string
  billingFrequency: BillingFrequency
  subscriptionDate: string
  trialEndDate: string
  renewalDate: string
  cancellationUrl: string
  notes: string
}

interface Errors {
  serviceName?: string
  price?: string
}

const INTENT_OPTIONS: {
  value: Intent
  label: string
  icon: React.ReactElement
  key: 'cancel' | 'remind' | 'renew' | 'undecided'
}[] = [
  { value: 'renew_automatically',      label: 'Renew automatically',      icon: <RefreshCwIcon size={16} />,  key: 'renew'     },
  { value: 'remind_before_billing',    label: 'Remind me before billing', icon: <BellIcon size={16} />,       key: 'remind'   },
  { value: 'cancel_before_trial_ends', label: 'Cancel before trial ends', icon: <BanIcon size={16} />,        key: 'cancel'   },
  { value: 'undecided',                label: 'Not now',                  icon: <CircleHelpIcon size={16} />, key: 'undecided' },
]

const FREQUENCY_OPTIONS: { value: BillingFrequency; label: string }[] = [
  { value: 'monthly',   label: 'Monthly'   },
  { value: 'yearly',    label: 'Yearly'    },
  { value: 'weekly',    label: 'Weekly'    },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'one_time',  label: 'One-time'  },
  { value: 'unknown',   label: 'Unknown'   },
]

const EMPTY: FormState = {
  serviceName: '',
  price: '',
  billingFrequency: 'monthly',
  subscriptionDate: '',
  trialEndDate: '',
  renewalDate: '',
  cancellationUrl: '',
  notes: '',
}

function validate(form: FormState): Errors {
  const errors: Errors = {}
  if (!form.serviceName.trim()) errors.serviceName = 'Service name is required'
  if (form.price && isNaN(parseFloat(form.price))) errors.price = 'Enter a valid price'
  return errors
}

export default function ManualEntryForm({ onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [intent, setIntent] = useState<Intent>('cancel_before_trial_ends')
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({})
  const [optionalOpen, setOptionalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...form, [key]: value }
    setForm(next)
    if (touched[key]) {
      const errs = validate(next)
      setErrors((prev) => ({ ...prev, [key]: errs[key as keyof Errors] }))
    }
  }

  function blur(key: keyof FormState) {
    setTouched((prev) => ({ ...prev, [key]: true }))
    const errs = validate(form)
    setErrors((prev) => ({ ...prev, [key]: errs[key as keyof Errors] }))
  }

  async function handleSubmit() {
    const allTouched = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])) as typeof touched
    setTouched(allTouched)
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return

    setSaving(true)
    setSubmitError(null)

    // Mocked submit — swap for chrome.runtime.sendMessage in production
    await new Promise((r) => setTimeout(r, 600))
    console.log('SAVE_SUBSCRIPTION', {
      serviceName: form.serviceName.trim(),
      intent,
      detectionSource: 'manual_entry' as const,
      cost: form.price ? parseFloat(form.price) : undefined,
      billingFrequency: form.billingFrequency,
      subscriptionDate: form.subscriptionDate || undefined,
      trialEndDate: form.trialEndDate || undefined,
      renewalDate: form.renewalDate || undefined,
      cancellationUrl: form.cancellationUrl || undefined,
      notes: form.notes || undefined,
    })

    setSaving(false)
    onSaved()
  }

  const hasErrors = Object.values(errors).some(Boolean)

  return (
    <>
      <div className="popup-body">

        {/* Service name */}
        <div className="form-section">
          <div className="form-field">
            <label className="form-label">
              Service name <span className="form-label-required">*</span>
            </label>
            <input
              className={`form-input${errors.serviceName && touched.serviceName ? ' form-input--error' : ''}`}
              placeholder="e.g. Spotify, Adobe CC…"
              value={form.serviceName}
              onChange={(e) => set('serviceName', e.target.value)}
              onBlur={() => blur('serviceName')}
              autoFocus
            />
            {errors.serviceName && touched.serviceName && (
              <p className="form-error-msg">{errors.serviceName}</p>
            )}
          </div>
        </div>

        {/* Intent */}
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
                onClick={() => setIntent(opt.value)}
              >
                <span className="intent-icon" aria-hidden="true">{opt.icon}</span>
                <span className="intent-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Billing */}
        <div className="form-section">
          <p className="form-section-title">Billing</p>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Price</label>
              <div className="form-input-prefix-wrap">
                <span className="form-input-prefix">$</span>
                <input
                  className={`form-input form-input--prefixed${errors.price && touched.price ? ' form-input--error' : ''}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value)}
                  onBlur={() => blur('price')}
                />
              </div>
              {errors.price && touched.price && (
                <p className="form-error-msg">{errors.price}</p>
              )}
            </div>
            <div className="form-field">
              <label className="form-label">Frequency</label>
              <select
                className="form-input"
                value={form.billingFrequency}
                onChange={(e) => set('billingFrequency', e.target.value as BillingFrequency)}
              >
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="form-section">
          <p className="form-section-title">Dates</p>
          <div className="form-row">
            <div className="form-field">
              <label className="form-label">Subscription date</label>
              <input
                className="form-input"
                type="date"
                value={form.subscriptionDate}
                onChange={(e) => set('subscriptionDate', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Renewal date</label>
              <input
                className="form-input"
                type="date"
                value={form.renewalDate}
                onChange={(e) => set('renewalDate', e.target.value)}
              />
            </div>
          </div>
          {(intent === 'cancel_before_trial_ends' || form.trialEndDate) && (
            <div className="form-field">
              <label className="form-label">Trial end date</label>
              <input
                className="form-input"
                type="date"
                value={form.trialEndDate}
                onChange={(e) => set('trialEndDate', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Optional fields */}
        <div className="form-section">
          <button
            type="button"
            className="optional-toggle"
            onClick={() => setOptionalOpen((v) => !v)}
            aria-expanded={optionalOpen}
          >
            <span className={`optional-toggle-icon${optionalOpen ? ' optional-toggle-icon--open' : ''}`}>
              <ChevronRightIcon size={12} />
            </span>
            Optional details
            <span className="optional-divider" />
          </button>

          {optionalOpen && (
            <div className="optional-fields">
              <div className="form-field">
                <label className="form-label">Cancellation URL</label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://…"
                  value={form.cancellationUrl}
                  onChange={(e) => set('cancellationUrl', e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  placeholder="Anything worth remembering…"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {submitError && (
          <div className="form-banner--error">
            <AlertCircleIcon size={14} aria-hidden="true" />
            {submitError}
          </div>
        )}

      </div>

      <div className="popup-footer">
        <button
          className="btn-submit"
          onClick={handleSubmit}
          disabled={saving || hasErrors}
        >
          {saving ? 'Saving…' : <><PinIcon size={14} aria-hidden="true" /> Track subscription</>}
        </button>
      </div>
    </>
  )
}
