import React, { useState } from 'react'
import type { Subscription } from '../types/subscription'
import { archiveSubscription, cancelSubscription, markRenewed } from '../services/subscriptionService'
import { formatCurrency } from '../utils/currency'
import SubscriptionEditor from './SubscriptionEditor'
import { Calendar as CalendarIcon, RefreshCw as RefreshCwIcon, Bell as BellIcon, Ban as BanIcon, CircleHelp as CircleHelpIcon } from 'lucide-react'

interface Props {
  subscription: Subscription
  onRefresh: () => void
  index: number
}

const STATUS_LABELS: Record<string, string> = {
  cancel_soon: 'Cancel Soon',
  renew_soon: 'Renew Soon',
  active: 'Active',
  archived: 'Archived',
  canceled: 'Canceled',
}

const INTENT_LABELS: Record<string, string> = {
  cancel_before_trial_ends: 'Cancel before trial',
  remind_before_billing: 'Remind before billing',
  renew_automatically: 'Auto-renew',
  undecided: 'Undecided',
}

const INTENT_ICON_MAP: Record<string, React.ReactElement> = {
  cancel_before_trial_ends: <BanIcon size={13} />,
  remind_before_billing:    <BellIcon size={13} />,
  renew_automatically:      <RefreshCwIcon size={13} />,
  undecided:                <CircleHelpIcon size={13} />,
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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function relativeLabel(dateStr: string): { text: string; urgency: 'urgent' | 'soon' | null } {
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, urgency: 'urgent' }
  if (diff === 0) return { text: 'today', urgency: 'urgent' }
  if (diff === 1) return { text: 'tomorrow', urgency: 'urgent' }
  if (diff <= 7) return { text: `in ${diff} days`, urgency: 'urgent' }
  if (diff <= 30) return { text: `in ${diff} days`, urgency: 'soon' }
  return { text: `in ${diff} days`, urgency: null }
}

const INTENT_CLASS: Record<string, string> = {
  cancel_before_trial_ends: 'sub-intent--cancel',
  remind_before_billing:    'sub-intent--remind',
  renew_automatically:      'sub-intent--renew',
  undecided:                'sub-intent--undecided',
}

interface LogoProps {
  name: string
  domain?: string
  bgColor: string
}

function ServiceLogo({ name, domain, bgColor }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const monogram = name.charAt(0).toUpperCase()

  if (domain && !imgFailed) {
    return (
      <div className="sub-logo" style={{ background: bgColor }} aria-hidden="true">
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          className="sub-logo-img"
          onError={() => setImgFailed(true)}
        />
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

  async function handleArchive() {
    await archiveSubscription(sub.id)
    onRefresh()
  }

  async function handleCancel() {
    await cancelSubscription(sub.id)
    onRefresh()
  }

  async function handleMarkRenewed() {
    await markRenewed(sub.id)
    onRefresh()
  }

  const dueDate = sub.renewalDate ?? sub.trialEndDate
  const bgColor = getMonogramColor(sub.serviceName)
  const staggerDelay = `${index * 50}ms`

  return (
    <>
      <div
        className={`sub-card sub-card--${sub.status}`}
        style={{ animationDelay: staggerDelay }}
      >
        <div className="sub-card-top">
          <span className={`sub-status-badge sub-status-badge--${sub.status}`}>
            <span className="status-dot" />
            {STATUS_LABELS[sub.status]}
          </span>
          {dueDate && (() => {
            const rel = relativeLabel(dueDate)
            return (
              <div className="sub-date-block">
                <span className="sub-date-main">
                  <CalendarIcon size={12} aria-hidden="true" />
                  {formatDate(dueDate)}
                </span>
                <span className={`sub-date-rel${rel.urgency ? ` sub-date-rel--${rel.urgency}` : ''}`}>
                  {rel.text}
                </span>
              </div>
            )
          })()}
        </div>

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

            <div className={`sub-intent ${INTENT_CLASS[sub.intent] ?? 'sub-intent--undecided'}`}>
              <span aria-hidden="true">{INTENT_ICON_MAP[sub.intent]}</span>
              {INTENT_LABELS[sub.intent] ?? sub.intent}
            </div>
          </div>
        </div>

        <div className="sub-actions">
          <button className="btn btn--ghost" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn btn--ghost" onClick={handleMarkRenewed}>Renewed</button>
          <button className="btn btn--ghost" onClick={handleArchive}>Archive</button>
          {sub.cancellationUrl && (
            <a href={sub.cancellationUrl} target="_blank" rel="noreferrer" className="btn btn--link">
              Cancel page
            </a>
          )}
          <span className="sub-actions-spacer" />
          <button className="btn btn--danger" onClick={handleCancel}>Cancel</button>
        </div>
      </div>

      {editing && (
        <SubscriptionEditor
          subscription={sub}
          onSave={() => { setEditing(false); onRefresh() }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  )
}
