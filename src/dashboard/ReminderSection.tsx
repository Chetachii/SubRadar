import { useState, useEffect } from 'react'
import { useFavicon } from '../utils/faviconCache'
import type { Subscription } from '../types/subscription'
import type { ReminderSummary } from '../types/reminder'
import { getReminderSummary } from '../services/reminderService'
import { setSnooze, dismissReminder } from '../services/subscriptionService'
import { getPreferences } from '../repository/preferencesRepository'
import type { Preferences } from '../types/preferences'
import { addDays, today } from '../utils/dates'
import SubscriptionEditor from './SubscriptionEditor'
import {
  Bell as BellIcon,
  Clock as ClockIcon,
  BellOff as BellOffIcon,
  ArrowRight as ArrowRightIcon,
} from 'lucide-react'

interface Props {
  subscriptions: Subscription[]
  onRefresh: () => void
}

interface ReminderCardProps {
  subscription: Subscription
  summary: ReminderSummary
  onRefresh: () => void
}

// ─── Copy ─────────────────────────────────────────────────────────────────────

function buildCopy(sub: Subscription, summary: ReminderSummary): string {
  const name = sub.serviceName
  const { state, daysUntilDue, isFreeTrial } = summary
  const thing = isFreeTrial ? 'trial' : 'subscription'

  if (state === 'snoozed') {
    return `Reminder snoozed. You'll be reminded again on the renewal day.`
  }

  if (state === 'due_today') {
    const when = daysUntilDue === 1 ? 'tomorrow' : `in ${daysUntilDue} days`
    if (sub.intent === 'cancel') {
      return `Your ${name} ${thing} ends ${when}. You planned to cancel before the next charge.`
    }
    if (sub.intent === 'renew') {
      return `Your ${name} subscription renews ${when}. Charge expected.`
    }
    return `Your ${name} subscription renews ${when}. Decide what you want to do before billing.`
  }

  // overdue — renewal day or past
  if (daysUntilDue === 0) {
    if (sub.intent === 'cancel') return `Your ${name} ${thing} ends today. Cancel now to avoid the charge.`
    if (sub.intent === 'renew') return `Your ${name} subscription renews today. Charge expected today.`
    return `Your ${name} subscription renews today. Review it before billing.`
  }
  if (sub.intent === 'cancel') return `Your ${name} renewal date has passed. Cancel now if you haven't already.`
  if (sub.intent === 'renew') return `Your ${name} subscription renewal was due. Confirm it's been handled.`
  return `Your ${name} renewal date has passed. Review your subscription now.`
}

function buildBadge(summary: ReminderSummary): { label: string; variant: 'soon' | 'urgent' | 'snoozed' } {
  if (summary.state === 'snoozed') return { label: 'Snoozed', variant: 'snoozed' }
  if (summary.state === 'due_today') {
    const n = summary.daysUntilDue
    return { label: n === 1 ? 'Tomorrow' : `In ${n} days`, variant: 'soon' }
  }
  // overdue
  if (summary.daysUntilDue === 0) return { label: 'Today', variant: 'urgent' }
  if (summary.daysUntilDue > 0) return { label: `In ${summary.daysUntilDue} day${summary.daysUntilDue === 1 ? '' : 's'}`, variant: 'urgent' }
  return { label: 'Overdue', variant: 'urgent' }
}

// ─── Service Logo ─────────────────────────────────────────────────────────────

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

function ServiceLogo({ name, domain }: { name: string; domain?: string }) {
  const favicon = useFavicon(domain)
  const bgColor = getMonogramColor(name)

  if (favicon) {
    return (
      <div className="sub-logo sub-logo--favicon" aria-hidden="true">
        <img src={favicon} alt="" className="sub-logo-img" />
      </div>
    )
  }
  return (
    <div className="sub-monogram" style={{ background: bgColor }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

// ─── ReminderCard ──────────────────────────────────────────────────────────────

function ReminderCard({ subscription: sub, summary, onRefresh }: ReminderCardProps) {
  const [editing, setEditing] = useState(false)
  const [acting, setActing] = useState(false)

  async function handleSnooze() {
    setActing(true)
    try {
      await setSnooze(sub.id, addDays(today(), 1))
      onRefresh()
    } finally {
      setActing(false)
    }
  }

  async function handleDismiss() {
    setActing(true)
    try {
      await dismissReminder(sub.id)
      onRefresh()
    } finally {
      setActing(false)
    }
  }

  const copy = buildCopy(sub, summary)
  const badge = buildBadge(summary)
  const showActions = summary.state !== 'snoozed'

  return (
    <>
      <div className={`reminder-card reminder-card--${summary.state}`}>
        <div className="reminder-card-body">
          <ServiceLogo name={sub.serviceName} domain={sub.sourceDomain} />
          <div className="reminder-card-content">
            <div className="reminder-card-head">
              <span className="reminder-card-name">{sub.serviceName}</span>
              <span className={`reminder-badge reminder-badge--${badge.variant}`}>
                {badge.label}
              </span>
            </div>
            <p className="reminder-card-copy">{copy}</p>
          </div>
        </div>

        <div className="reminder-card-actions">
          {showActions && (
            <>
              <button
                className="btn btn--ghost"
                onClick={handleSnooze}
                disabled={acting}
                title="Hide this reminder and show it again tomorrow"
              >
                <ClockIcon size={12} aria-hidden="true" />
                Snooze until tomorrow
              </button>
              <button
                className="btn btn--ghost"
                onClick={handleDismiss}
                disabled={acting}
                title="Hide this reminder — renewal-day reminder still fires"
              >
                <BellOffIcon size={12} aria-hidden="true" />
                Dismiss this reminder
              </button>
            </>
          )}
          <button
            className="btn btn--link reminder-card-view"
            onClick={() => setEditing(true)}
          >
            View details
            <ArrowRightIcon size={12} aria-hidden="true" />
          </button>
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

// ─── ReminderSection ──────────────────────────────────────────────────────────

const STATE_ORDER: Record<string, number> = { overdue: 0, due_today: 1, snoozed: 2 }

export default function ReminderSection({ subscriptions, onRefresh }: Props) {
  const [prefs, setPrefs] = useState<Preferences | null>(null)

  useEffect(() => {
    getPreferences().then(setPrefs)
  }, [])

  // Don't render anything until prefs are ready or if there are no subscriptions
  if (!prefs || subscriptions.length === 0) return null

  const reminders = subscriptions
    .map(sub => ({ sub, summary: getReminderSummary(sub, prefs) }))
    .filter((item): item is { sub: Subscription; summary: ReminderSummary } =>
      item.summary !== null && item.summary.state !== 'upcoming'
    )
    .sort((a, b) => (STATE_ORDER[a.summary.state] ?? 99) - (STATE_ORDER[b.summary.state] ?? 99))

  return (
    <section className="reminder-section" aria-label="Reminders">
      <div className="reminder-section-header">
        <BellIcon size={13} aria-hidden="true" className="reminder-section-icon" />
        <h2 className="reminder-section-title">Reminders</h2>
        {reminders.length > 0 && (
          <span className="reminder-section-count">{reminders.length}</span>
        )}
      </div>

      {reminders.length === 0 ? (
        <div className="reminder-empty">
          <p className="reminder-empty-text">You're all caught up — no active reminders.</p>
        </div>
      ) : (
        <div className="reminder-list">
          {reminders.map(({ sub, summary }) => (
            <ReminderCard
              key={sub.id}
              subscription={sub}
              summary={summary}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </section>
  )
}
