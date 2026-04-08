import { useState } from 'react'
import { useFavicon } from '../utils/faviconCache'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Bell as BellIcon, Clock as ClockIcon, BellOff as BellOffIcon } from 'lucide-react'
import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import type { ReminderSummary } from '../types/reminder'
import { getReminderSummary } from '../services/reminderService'
import { setSnooze, dismissReminder } from '../services/subscriptionService'
import { addDays, today } from '../utils/dates'
import { formatCurrency } from '../utils/currency'
import SubscriptionEditor from './SubscriptionEditor'

interface Props {
  subscriptions: Subscription[]
  prefs: Preferences | null
  onRefresh: () => void
}

// ─── Copy helpers (inlined from ReminderSection) ───────────────────────────

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

// ─── Service Logo ──────────────────────────────────────────────────────────

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

// ─── State ordering ────────────────────────────────────────────────────────

const STATE_ORDER: Record<string, number> = { overdue: 0, due_today: 1, snoozed: 2 }

// ─── NotifItem ─────────────────────────────────────────────────────────────

interface NotifItemProps {
  sub: Subscription
  summary: ReminderSummary
  onSnooze: () => void
  onDismiss: () => void
  onOpenEditor: () => void
}

function NotifItem({ sub, summary, onSnooze, onDismiss, onOpenEditor }: NotifItemProps) {
  const [acting, setActing] = useState(false)
  const todayStr = today()

  const isActive = summary.state === 'due_today' || summary.state === 'overdue'
  const isSnoozed = summary.state === 'snoozed'
  const isInactive = isSnoozed

  const copy = buildCopy(sub, summary)
  const badge = buildBadge(summary)

  async function handleSnooze() {
    setActing(true)
    try {
      await setSnooze(sub.id, addDays(todayStr, 1))
      onSnooze()
    } finally {
      setActing(false)
    }
  }

  async function handleDismiss() {
    setActing(true)
    try {
      await dismissReminder(sub.id)
      onDismiss()
    } finally {
      setActing(false)
    }
  }

  const costStr = sub.cost != null && sub.billingFrequency
    ? `${formatCurrency(sub.cost, sub.currency)} / ${sub.billingFrequency}`
    : null

  return (
    <li
      className={`notif-item${isInactive ? ' notif-item--inactive' : ''}`}
      onClick={isInactive ? onOpenEditor : undefined}
    >
      <div className="notif-item-row">
        <ServiceLogo name={sub.serviceName} domain={sub.sourceDomain} />
        <div className="notif-item-body">
          <div className="notif-item-head">
            <span className="notif-item-name">{sub.serviceName}</span>
            {isSnoozed && (
              <span className="notif-state-label notif-state-label--snoozed">Snoozed</span>
            )}
            {isActive && (
              <span className={`reminder-badge reminder-badge--${badge.variant}`}>{badge.label}</span>
            )}
          </div>
          <p className="notif-item-copy">{copy}</p>
          {costStr && <p className="notif-item-meta">{costStr}</p>}
          {isActive && (
            <div className="notif-item-actions">
              <button
                className="btn btn--ghost"
                onClick={(e) => { e.stopPropagation(); handleSnooze() }}
                disabled={acting}
                title="Snooze until tomorrow"
              >
                <ClockIcon size={12} aria-hidden="true" />
                Snooze
              </button>
              <button
                className="btn btn--ghost"
                onClick={(e) => { e.stopPropagation(); handleDismiss() }}
                disabled={acting}
                title="Dismiss this reminder"
              >
                <BellOffIcon size={12} aria-hidden="true" />
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

// ─── NotificationBell ──────────────────────────────────────────────────────

export default function NotificationBell({ subscriptions, prefs, onRefresh }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const items = (prefs ? subscriptions : [])
    .filter(s => s.status === 'active')
    .flatMap(s => {
      const summary = getReminderSummary(s, prefs!)
      if (!summary || summary.state === 'upcoming') return []
      return [{ sub: s, summary }]
    })
    .sort((a, b) => (STATE_ORDER[a.summary.state] ?? 99) - (STATE_ORDER[b.summary.state] ?? 99))

  const activeCount = items.filter(({ summary }) =>
    summary.state === 'due_today' || summary.state === 'overdue'
  ).length

  return (
    <>
      <PopoverPrimitive.Root>
        <PopoverPrimitive.Trigger asChild>
          <button className="notif-bell-btn" aria-label="Notifications" data-tooltip="Notifications">
            <BellIcon size={16} />
            {activeCount > 0 && (
              <span className="notif-bell-badge">{activeCount}</span>
            )}
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content align="end" sideOffset={8} className="notif-popover">
            <div className="notif-popover-header">
              <span className="notif-popover-title">Reminders</span>
              {activeCount > 0 && <span className="notif-bell-badge" style={{ position: 'static' }}>{activeCount}</span>}
            </div>

            {items.length === 0 ? (
              <div className="notif-empty">You're all caught up — no active reminders.</div>
            ) : (
              <ul className="notif-list">
                {items.map(({ sub, summary }) => (
                  <NotifItem
                    key={sub.id}
                    sub={sub}
                    summary={summary}
                    onSnooze={onRefresh}
                    onDismiss={onRefresh}
                    onOpenEditor={() => setEditingId(sub.id)}
                  />
                ))}
              </ul>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {editingId && (
        <SubscriptionEditor
          subscription={subscriptions.find(s => s.id === editingId)!}
          onSave={() => { setEditingId(null); onRefresh() }}
          onClose={() => setEditingId(null)}
          onDelete={() => { setEditingId(null); onRefresh() }}
        />
      )}
    </>
  )
}
