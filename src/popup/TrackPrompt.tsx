import { useState } from 'react'
import type { DetectionResult, Intent } from '../types/subscription'
import { RefreshCw as RefreshCwIcon, Bell as BellIcon, Ban as BanIcon, Pin as PinIcon } from 'lucide-react'
import { CURRENCIES } from '../utils/currency'

interface Props {
  result: DetectionResult
  onSaved: () => void
  onDismiss: () => void
}

const INTENT_OPTIONS = [
  {
    value: 'cancel' as Intent,
    label: 'Cancel',
    desc: 'You already plan to cancel this before the next charge. We will send you a reminder 3 days before the renewal date.',
    icon: <BanIcon size={16} />,
    key: 'cancel',
  },
  {
    value: 'renew' as Intent,
    label: 'Renew',
    desc: 'You want to keep this subscription and let it continue. This is a heads-up that charge is expected.',
    icon: <RefreshCwIcon size={16} />,
    key: 'renew',
  },
  {
    value: 'remind_before_billing' as Intent,
    label: 'Remind me',
    desc: 'You want a reminder so you can decide later.',
    icon: <BellIcon size={16} />,
    key: 'remind',
  },
]

function formatPriceDisplay(
  price: number | undefined,
  currency: string | undefined,
  billingFrequency: string | undefined,
): string | null {
  if (price == null) return null
  const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : (currency ?? '$')
  const formatted = `${symbol}${price.toFixed(2)}`
  if (billingFrequency === 'monthly') return `${formatted}/mo`
  if (billingFrequency === 'yearly') return `${formatted}/yr`
  return formatted
}

export default function TrackPrompt({ result, onSaved, onDismiss }: Props) {
  const [serviceName, setServiceName] = useState(result.serviceName ?? '')
  const [website, setWebsite] = useState(result.pageUrl ?? '')
  const [intent, setIntent] = useState<Intent>('remind_before_billing')
  const [isFreeTrial, setIsFreeTrial] = useState(
    result.trialDurationDays !== undefined && result.trialDurationDays > 0,
  )
  const [renewalDate, setRenewalDate] = useState(result.detectedRenewalDate ?? '')
  const [trialEndDate, setTrialEndDate] = useState('')
  const [cost, setCost] = useState(result.price != null ? String(result.price) : '')
  const [currency, setCurrency] = useState(
    CURRENCIES.find((c) => c.code === result.currency) ? (result.currency ?? 'USD') : 'USD'
  )
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const headline = result.serviceName
    ? `Looks like you're signing up for ${result.serviceName}`
    : 'Track this subscription with SubRadar?'

  const priceDisplay = formatPriceDisplay(result.price, result.currency, result.billingFrequency)

  async function handleSave() {
    if (!serviceName.trim()) {
      setFieldError('Service name is required.')
      return
    }
    setFieldError(null)
    setSaveError(null)
    setSaving(true)
    const response = await chrome.runtime.sendMessage({
      type: 'SAVE_SUBSCRIPTION',
      payload: {
        serviceName: serviceName.trim(),
        intent,
        isFreeTrial,
        detectionSource: 'auto_detected' as const,
        sourceDomain: result.sourceDomain,
        website: website.trim() || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        currency,
        billingFrequency: result.billingFrequency,
        renewalDate: renewalDate || undefined,
        trialEndDate: isFreeTrial ? (trialEndDate || undefined) : undefined,
      },
    })
    setSaving(false)
    if (response?.ok) {
      onSaved()
    } else {
      setSaveError(response?.error ?? 'Something went wrong.')
    }
  }

  const selectedDesc = INTENT_OPTIONS.find((o) => o.value === intent)?.desc

  return (
    <>
      <div className="popup-body popup-body--airy">
        {saveError && (
          <div className="form-banner--error form-banner--airy">{saveError}</div>
        )}
        <header className="popup-intro">
          <h2 className="popup-lead-title">{headline}</h2>
          <p className="popup-lead-sub">Set your intent now so we can remind you before billing starts.</p>
        </header>

        <section className="popup-card">
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary">Service name</label>
            <input
              className={`form-input form-input--comfort${fieldError ? ' form-input--error' : ''}`}
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g. Netflix"
              autoFocus
            />
            {fieldError && <p className="form-error-msg">{fieldError}</p>}
          </div>
          {priceDisplay && (
            <p className="form-hint-inline">
              <span className="detected-price-badge">{priceDisplay}</span> detected on page
            </p>
          )}
        </section>

        <section className="popup-card">
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary">Checkout page <span className="form-label-optional-inline">(optional)</span></label>
            <input
              className="form-input form-input--comfort"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. claude.com/pricing"
            />
          </div>
        </section>

        <section className="popup-card">
          <p className="form-section-heading">What do you want to do?</p>
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
          {selectedDesc && <p className="intent-desc intent-desc--airy">{selectedDesc}</p>}
        </section>

        <section className="popup-card">
          <p className="form-section-heading">Is this a free trial?</p>
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

        <section className="popup-card">
          <p className="form-section-heading">Dates</p>
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary">Renewal date</label>
            <input
              className="form-input form-input--comfort"
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
            />
            <p className="form-hint-inline">The date billing starts or the next charge happens.</p>
          </div>
          {isFreeTrial && (
            <div className="form-field form-field--spaced form-field--mt">
              <label className="form-label form-label--primary">Trial end date <span className="form-label-optional-inline">(optional)</span></label>
              <input
                className="form-input form-input--comfort"
                type="date"
                value={trialEndDate}
                onChange={(e) => setTrialEndDate(e.target.value)}
              />
              <p className="form-hint-inline">Often the same as the renewal date.</p>
            </div>
          )}
        </section>

        <section className="popup-card">
          <p className="form-section-heading">Cost <span className="form-label-optional-inline">(optional)</span></p>
          <div className="form-field form-field--spaced">
            <label className="form-label form-label--primary">Amount</label>
            <div className="form-input-prefix-wrap">
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
              <input
                className="form-input form-input--comfort form-input--prefixed-wide"
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="popup-footer popup-footer--airy">
        <div className="popup-footer-row popup-footer-row--airy">
          <button type="button" className="btn-dismiss btn-dismiss--airy" onClick={onDismiss}>Not now</button>
          <button type="button" className="btn-submit btn-submit--airy" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : <><PinIcon size={15} aria-hidden="true" /> Track it</>}
          </button>
        </div>
      </div>
    </>
  )
}
