import React, { useState, useEffect, useRef } from 'react'
import type { Intent } from '../types/subscription'
import { RefreshCw as RefreshCwIcon, Bell as BellIcon, Ban as BanIcon, Pin as PinIcon, AlertCircle as AlertCircleIcon, ChevronDown as ChevronDownIcon } from 'lucide-react'
import { CURRENCIES } from '../utils/currency'
import { today } from '../utils/dates'

interface Props {
  onSaved: () => void
}

interface FormState {
  serviceName: string
  website: string
  price: string
  renewalDate: string
  trialEndDate: string
}

interface Errors {
  serviceName?: string
  price?: string
}

const INTENT_OPTIONS: {
  value: Intent
  label: string
  desc: string
  icon: React.ReactElement
  key: 'cancel' | 'remind' | 'renew'
}[] = [
  {
    value: 'cancel',
    label: 'Cancel',
    desc: 'You already plan to cancel this before the next charge. We will send you a reminder 3 days before the renewal date.',
    icon: <BanIcon size={16} />,
    key: 'cancel',
  },
  {
    value: 'renew',
    label: 'Renew',
    desc: 'You want to keep this subscription and let it continue. This is a heads-up that charge is expected.',
    icon: <RefreshCwIcon size={16} />,
    key: 'renew',
  },
  {
    value: 'remind_before_billing',
    label: 'Remind me',
    desc: 'You want a reminder so you can decide later.',
    icon: <BellIcon size={16} />,
    key: 'remind',
  },
]

const EMPTY: FormState = {
  serviceName: '',
  website: '',
  price: '',
  renewalDate: '',
  trialEndDate: '',
}

function extractDomain(website: string): string | undefined {
  const s = website.trim()
  if (!s) return undefined
  try {
    const url = s.includes('://') ? s : `https://${s}`
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return undefined
  }
}

function validate(form: FormState): Errors {
  const errors: Errors = {}
  if (!form.serviceName.trim()) errors.serviceName = 'Service name is required'
  if (form.price && isNaN(parseFloat(form.price))) errors.price = 'Enter a valid price'
  return errors
}

export default function ManualEntryForm({ onSaved }: Props) {
  const TODAY = today()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [currency, setCurrency] = useState('USD')
  const [isFreeTrial, setIsFreeTrial] = useState(true)
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [websiteManuallyEdited, setWebsiteManuallyEdited] = useState(false)
  const [websiteLooking, setWebsiteLooking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (websiteManuallyEdited) return
    const name = form.serviceName.trim()
    if (!name) { setForm((prev) => ({ ...prev, website: '' })); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (abortRef.current) abortRef.current.abort()
    setWebsiteLooking(true)
    const controller = new AbortController()
    abortRef.current = controller
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(name)}`,
          { signal: controller.signal }
        )
        if (!res.ok) return
        const results = await res.json() as { name: string; domain: string }[]
        if (results.length > 0) {
          setForm((prev) => ({ ...prev, website: results[0].domain }))
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        // silently fail
      } finally {
        setWebsiteLooking(false)
      }
    }, 400)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.serviceName, websiteManuallyEdited])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    const next = { ...form, [key]: value }
    if (key === 'website') setWebsiteManuallyEdited(true)
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
    if (!intent) { setSubmitError('Please select what you want to do.'); return }

    setSaving(true)
    setSubmitError(null)

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SUBSCRIPTION',
        payload: {
          serviceName: form.serviceName.trim(),
          sourceDomain: extractDomain(form.website),
          intent: intent!,
          isFreeTrial,
          detectionSource: 'manual_entry' as const,
          cost: form.price ? parseFloat(form.price) : undefined,
          currency,
          subscriptionDate: TODAY,
          renewalDate: form.renewalDate || undefined,
          trialEndDate: isFreeTrial ? (form.trialEndDate || undefined) : undefined,
        },
      })
      if (response?.error) throw new Error(response.error)
      onSaved()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedDesc = INTENT_OPTIONS.find((o) => o.value === intent)?.desc

  return (
    <>
      <div className="popup-body popup-body--airy">
        <header className="popup-intro">
          <h2 className="popup-lead-title">Track a free trial or subscription</h2>
          <p className="popup-lead-sub">Set your intent and add a renewal date so we can remind you before billing starts.</p>
        </header>

        <section className="popup-card" aria-labelledby="label-service">
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary" id="label-service">
              Service name <span className="form-label-required">*</span>
            </label>
            <input
              className={`form-input form-input--comfort${errors.serviceName && touched.serviceName ? ' form-input--error' : ''}`}
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
        </section>

        <section className="popup-card" aria-labelledby="label-website">
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary" id="label-website">
              Website <span className="form-label-optional-inline">(optional)</span>
            </label>
            <input
              className="form-input form-input--comfort"
              placeholder={websiteLooking ? 'Looking up…' : 'e.g. cursor.com'}
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </div>
        </section>

        <section className="popup-card" aria-labelledby="label-intent">
          <p className="form-section-heading" id="label-intent">What do you want to do?</p>
          <div className="intent-grid intent-grid--airy">
            {INTENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={[
                  'intent-option intent-option--airy',
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
          {selectedDesc && (
            <p className="intent-desc intent-desc--airy">{selectedDesc}</p>
          )}
        </section>

        <section className="popup-card" aria-labelledby="label-trial">
          <p className="form-section-heading" id="label-trial">Is this a free trial?</p>
          <div className="trial-toggle">
            <button
              type="button"
              className={`trial-toggle-btn${isFreeTrial ? ' trial-toggle-btn--active' : ''}`}
              onClick={() => setIsFreeTrial(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className={`trial-toggle-btn${!isFreeTrial ? ' trial-toggle-btn--active' : ''}`}
              onClick={() => setIsFreeTrial(false)}
            >
              No
            </button>
          </div>
        </section>

        <section className="popup-card" aria-labelledby="label-dates">
          <p className="form-section-heading" id="label-dates">Dates</p>
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary">Subscription date</label>
            <input
              className="form-input form-input--comfort"
              type="date"
              value={TODAY}
              readOnly
              style={{ color: 'var(--color-text-muted, #888)', cursor: 'default' }}
            />
          </div>
          <div className="form-field form-field--spaced form-field--mt">
            <label className="form-label form-label--primary">Renewal date</label>
            <input
              className="form-input form-input--comfort"
              type="date"
              value={form.renewalDate}
              onChange={(e) => set('renewalDate', e.target.value)}
            />
            <p className="form-hint-inline">The date billing starts or the next charge happens.</p>
          </div>
          {isFreeTrial && (
            <div className="form-field form-field--spaced form-field--mt">
              <label className="form-label form-label--primary">Trial end date <span className="form-label-optional-inline">(optional)</span></label>
              <input
                className="form-input form-input--comfort"
                type="date"
                value={form.trialEndDate}
                onChange={(e) => set('trialEndDate', e.target.value)}
              />
              <p className="form-hint-inline">Often the same as the renewal date.</p>
            </div>
          )}
        </section>

        <section className="popup-card" aria-labelledby="label-cost">
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary" id="label-cost">
              Cost <span className="form-label-optional-inline">(optional)</span>
            </label>
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
              <input
                className={`form-input form-input--comfort form-input--prefixed-wide${errors.price && touched.price ? ' form-input--error' : ''}`}
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
        </section>

        {submitError && (
          <div className="form-banner--error form-banner--airy">
            <AlertCircleIcon size={14} aria-hidden="true" />
            {submitError}
          </div>
        )}
      </div>

      <div className="popup-footer popup-footer--airy">
        <button
          className="btn-submit btn-submit--airy"
          onClick={handleSubmit}
          disabled={saving}
        >
          {saving ? 'Saving…' : <><PinIcon size={15} aria-hidden="true" /> Track it</>}
        </button>
      </div>
    </>
  )
}
