import React, { useState } from 'react'
import type { Subscription } from '../types/subscription'
import { formatCurrency } from '../utils/currency'
import SubscriptionEditor from './SubscriptionEditor'
import { Calendar as CalendarIcon, RefreshCw as RefreshCwIcon, Bell as BellIcon, Ban as BanIcon } from 'lucide-react'
import { useFavicon } from '../utils/faviconCache'

interface Props {
  subscription: Subscription
  onRefresh: () => void
  index: number
}

const INTENT_LABELS: Record<string, string> = {
  cancel: 'Cancel',
  renew: 'Renew',
  remind_before_billing: 'Remind Before Billing',
}

const INTENT_ICON_MAP: Record<string, React.ReactElement> = {
  cancel:               <BanIcon size={13} />,
  remind_before_billing: <BellIcon size={13} />,
  renew:                <RefreshCwIcon size={13} />,
}

const INTENT_CLASS: Record<string, string> = {
  cancel:               'sub-intent--cancel',
  remind_before_billing: 'sub-intent--remind',
  renew:                'sub-intent--renew',
}

const INTENT_CARD_CLASS: Record<string, string> = {
  cancel:               'cancel',
  renew:                'renew',
  remind_before_billing: 'remind',
}

const MONOGRAM_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#ec4899',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#0ea5e9',
]

function getMonogramColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return MONOGRAM_COLORS[Math.abs(hash) % MONOGRAM_COLORS.length]
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

function formatDate(dateStr: string): string {
  try {
    return parseLocalDate(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function relativeLabel(dateStr: string): { text: string; urgency: 'urgent' | 'soon' | null } {
  const diff = Math.ceil((parseLocalDate(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgency: 'urgent' }
  if (diff === 0) return { text: 'today', urgency: 'urgent' }
  if (diff === 1) return { text: 'tomorrow', urgency: 'urgent' }
  if (diff <= 7) return { text: `in ${diff} days`, urgency: 'urgent' }
  if (diff <= 30) return { text: `in ${diff} days`, urgency: 'soon' }
  return { text: `in ${diff} days`, urgency: null }
}

interface LogoProps {
  name: string
  domain?: string
  bgColor: string
}

function ServiceLogo({ name, domain, bgColor }: LogoProps) {
  const favicon = useFavicon(domain)
  const monogram = name.charAt(0).toUpperCase()

  if (favicon) {
    return (
      <div className="sub-logo sub-logo--favicon" aria-hidden="true">
        <img src={favicon} alt="" className="sub-logo-img" />
      </div>
    )
  }

  return (
    <div className="sub-monogram" style={{ background: bgColor }} aria-hidden="true">
      {monogram}
    </div>
  )
}

export default function SubscriptionCard({ subscription: sub, onRefresh, index }: Props) {
  const [editing, setEditing] = useState(false)

  async function handleRestore() {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_SUBSCRIPTION',
      payload: { id: sub.id, patch: { status: 'active' } },
    })
    setEditing(true)
  }

  const dueDate = sub.renewalDate ?? sub.trialEndDate
  const bgColor = getMonogramColor(sub.serviceName)
  const staggerDelay = `${Math.min(index * 50, 300)}ms`
  const cardClass = sub.status === 'archived'
    ? 'archived'
    : (INTENT_CARD_CLASS[sub.intent] ?? '')

  return (
    <>
      <div
        className={`sub-card sub-card--${cardClass}`}
        style={{ animationDelay: staggerDelay }}
      >
        {dueDate && (() => {
          const rel = relativeLabel(dueDate)
          return (
            <div className="sub-card-top">
              <div className="sub-date-row">
                <span className="sub-date-main">
                  <CalendarIcon size={12} aria-hidden="true" />
                  {formatDate(dueDate)}
                </span>
                <span className={`sub-date-rel${rel.urgency ? ` sub-date-rel--${rel.urgency}` : ''}`}>
                  {rel.text}
                </span>
              </div>
            </div>
          )
        })()}

        <div className="sub-card-body">
          <ServiceLogo name={sub.serviceName} domain={sub.sourceDomain} bgColor={bgColor} />

          <div className="sub-content">
            <span className="sub-name">{sub.serviceName}</span>

            {sub.sourceDomain && (
              <div className="sub-domain">
                <span className="sub-domain-dot">·</span>
                {sub.sourceDomain}
              </div>
            )}

            <div className="sub-card-divider" />

            <div className="sub-meta">
              {sub.cost !== undefined && (
                <span className="sub-meta-item sub-meta-item--price">
                  {formatCurrency(sub.cost, sub.currency)}
                  {sub.billingFrequency && sub.billingFrequency !== 'unknown' && (
                    <span className="sub-meta-freq"> / {sub.billingFrequency.replace('_', ' ')}</span>
                  )}
                </span>
              )}
            </div>

          </div>
        </div>

        <div className="sub-actions">
          <div className={`sub-intent ${INTENT_CLASS[sub.intent] ?? ''}`}>
            <span aria-hidden="true">{INTENT_ICON_MAP[sub.intent]}</span>
            {INTENT_LABELS[sub.intent] ?? sub.intent}
          </div>
          {sub.status === 'archived' ? (
            <button className="btn btn--ghost" onClick={handleRestore}>Restore</button>
          ) : (
            <button className="btn btn--ghost" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>
      </div>

      {editing && (
        <SubscriptionEditor
          subscription={sub}
          onSave={() => { setEditing(false); onRefresh() }}
          onClose={() => setEditing(false)}
          onDelete={() => { setEditing(false); onRefresh() }}
        />
      )}
    </>
  )
}
