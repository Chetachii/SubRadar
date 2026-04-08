import { useState } from 'react'
import { useFavicon } from '../utils/faviconCache'
import type { BillingFrequency, DetectionResult, Intent, Subscription } from '../types/subscription'
import { RefreshCw as RefreshCwIcon, Bell as BellIcon, Ban as BanIcon, Pin as PinIcon, ChevronDown as ChevronDownIcon, CheckCircle as CheckCircleIcon } from 'lucide-react'
import { CURRENCIES, formatCurrency } from '../utils/currency'
import { daysBetween } from '../utils/dates'

function ServiceAvatar({ serviceName, sourceDomain }: { serviceName: string; sourceDomain?: string }) {
  const favicon = useFavicon(sourceDomain)
  return (
    <div className={`success-avatar${favicon ? ' success-avatar--favicon' : ''}`} aria-hidden="true">
      {favicon
        ? <img src={favicon} alt="" />
        : serviceName.charAt(0).toUpperCase()
      }
    </div>
  )
}

function formatBillingFrequency(freq: BillingFrequency | undefined): string {
  switch (freq) {
    case 'monthly': return '/ mo'
    case 'yearly': return '/ yr'
    case 'weekly': return '/ wk'
    case 'quarterly': return '/ qtr'
    case 'one_time': return ' one-time'
    default: return ''
  }
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildReminderCopy(sub: Subscription): string {
  if (!sub.renewalDate) return ''
  const renewalStr = formatDate(sub.renewalDate)
  if (!sub.reminderDate || sub.reminderDate === sub.renewalDate) {
    return `We'll remind you on the renewal day (${renewalStr}).`
  }
  const lead = daysBetween(sub.reminderDate, sub.renewalDate)
  const reminderStr = formatDate(sub.reminderDate)
  return `We'll remind you ${lead} day${lead === 1 ? '' : 's'} before renewal (${reminderStr}) and on the renewal day (${renewalStr}).`
}

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


export default function TrackPrompt({ result, onSaved, onDismiss }: Props) {
  const [serviceName, setServiceName] = useState(result.serviceName ?? '')
  const [website, setWebsite] = useState(result.pageUrl ?? '')
  const [intent, setIntent] = useState<Intent | null>(null)
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
  const [serviceNameError, setServiceNameError] = useState<string | null>(null)
  const [intentError, setIntentError] = useState<string | null>(null)
  const [renewalDateError, setRenewalDateError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedSub, setSavedSub] = useState<Subscription | null>(null)

  const headline = result.serviceName
    ? `Looks like you're signing up for ${result.serviceName}`
    : 'Track this subscription with SubRadar?'


  async function handleSave() {
    if (!serviceName.trim()) {
      setServiceNameError('Service name is required.')
      return
    }
    if (!renewalDate) {
      setRenewalDateError('Renewal date is required.')
      return
    }
    if (!intent) {
      setIntentError('Please select what you want to do.')
      return
    }
    setServiceNameError(null)
    setIntentError(null)
    setRenewalDateError(null)
    setSaveError(null)
    setSaving(true)
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_SUBSCRIPTION',
        payload: {
          serviceName: serviceName.trim(),
          intent: intent!,
          isFreeTrial,
          detectionSource: 'auto_detected' as const,
          sourceDomain: result.sourceDomain,
          cost: cost ? parseFloat(cost) : undefined,
          currency,
          billingFrequency: result.billingFrequency as BillingFrequency | undefined,
          renewalDate: renewalDate || undefined,
          trialEndDate: isFreeTrial ? (trialEndDate || undefined) : undefined,
        },
      })
      if (response?.error) throw new Error(response.error)
      const sub = response.subscription as Subscription
      setSavedSub(sub)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const selectedDesc = INTENT_OPTIONS.find((o) => o.value === intent)?.desc

  if (savedSub) {
    return (
      <>
        <div className="popup-body popup-body--airy">
          <div className="success-view">
            <div className="success-icon"><CheckCircleIcon size={28} aria-hidden="true" /></div>
            <p className="success-title">Subscription tracked!</p>
            <div className="success-details">
              <ServiceAvatar serviceName={savedSub.serviceName} sourceDomain={savedSub.sourceDomain} />
              <p className="success-service">{savedSub.serviceName}</p>
              {savedSub.cost != null && (
                <p className="success-cost">
                  {formatCurrency(savedSub.cost, savedSub.currency)}{formatBillingFrequency(savedSub.billingFrequency)}
                </p>
              )}
              {savedSub.renewalDate && (
                <div className="success-details-meta">
                  <span className="success-renewal-badge">
                    Renews {formatDate(savedSub.renewalDate)}
                  </span>
                  <p className="success-remind">
                    <BellIcon size={11} aria-hidden="true" />
                    {buildReminderCopy(savedSub)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="popup-footer popup-footer--airy">
          <div className="popup-footer-row popup-footer-row--airy">
            <button type="button" className="btn-dismiss btn-dismiss--airy" onClick={onSaved}>Done</button>
            <button
              className="btn-submit btn-submit--airy"
              onClick={() => { chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }).catch(() => {}); onSaved() }}
            >
              View Dashboard
            </button>
          </div>
        </div>
      </>
    )
  }

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
              className={`form-input form-input--comfort${serviceNameError ? ' form-input--error' : ''}`}
              value={serviceName}
              onChange={(e) => { setServiceName(e.target.value); if (serviceNameError) setServiceNameError(null) }}
              placeholder="e.g. Netflix"
              autoFocus
            />
            {serviceNameError && <p className="form-error-msg">{serviceNameError}</p>}
          </div>
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
                onClick={() => { setIntent(opt.value); if (intentError) setIntentError(null) }}
              >
                <span className="intent-icon" aria-hidden="true">{opt.icon}</span>
                <span className="intent-label">{opt.label}</span>
              </button>
            ))}
          </div>
          {selectedDesc && <p className="intent-desc intent-desc--airy">{selectedDesc}</p>}
          {intentError && <p className="form-error-msg">{intentError}</p>}
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
            <label className="form-label form-label--primary">
              Renewal date <span className="form-label-required">*</span>
            </label>
            <input
              className={`form-input form-input--comfort${renewalDateError ? ' form-input--error' : ''}`}
              type="date"
              value={renewalDate}
              onChange={(e) => { setRenewalDate(e.target.value); if (renewalDateError) setRenewalDateError(null) }}
            />
            {renewalDateError
              ? <p className="form-error-msg">{renewalDateError}</p>
              : <p className="form-hint-inline">The date billing starts or the next charge happens.</p>
            }
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
