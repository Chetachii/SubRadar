import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import { groupBySection } from '../services/statusService'
import SubscriptionCard from './SubscriptionCard'

type FilterTab = 'all' | 'active' | 'trials' | 'cancel_soon' | 'archived'

interface Props {
  subscriptions: Subscription[]
  prefs: Preferences
  filter: FilterTab
  search: string
  onRefresh: () => void
}

const SECTION_ICONS: Record<string, string> = {
  cancelSoon: '🔴',
  renewSoon: '🟡',
  active: '🟢',
  trials: '⏳',
  archived: '📦',
}

const SECTION_EMPTY: Record<string, { icon: string; title: string; hint: string }> = {
  cancelSoon: {
    icon: '🚫',
    title: 'Nothing to cancel right now',
    hint: 'Subscriptions you plan to cancel will appear here when their deadline approaches.',
  },
  renewSoon: {
    icon: '🔔',
    title: 'No renewals coming up',
    hint: 'Subscriptions renewing soon will show up here.',
  },
  active: {
    icon: '✅',
    title: 'No active subscriptions',
    hint: 'Subscriptions you are actively tracking will appear here.',
  },
  trials: {
    icon: '⏳',
    title: 'No trials ending soon',
    hint: 'Free trials expiring within 14 days will appear here.',
  },
  archived: {
    icon: '📦',
    title: 'Nothing archived yet',
    hint: 'Subscriptions you archive will be stored here for reference.',
  },
}

function matches(sub: Subscription, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    sub.serviceName.toLowerCase().includes(q) ||
    (sub.sourceDomain?.toLowerCase().includes(q) ?? false)
  )
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export default function SubscriptionList({ subscriptions, prefs, filter, search, onRefresh }: Props) {
  const groups = groupBySection(subscriptions, prefs)

  const now = Date.now()
  const trialsSoon = subscriptions.filter((s) => {
    if (!s.trialEndDate || s.status === 'archived' || s.status === 'canceled') return false
    const diff = new Date(s.trialEndDate).getTime() - now
    return diff >= 0 && diff <= FOURTEEN_DAYS_MS
  })

  const sections: { key: string; label: string; items: Subscription[]; show: boolean }[] = [
    {
      key: 'cancelSoon',
      label: 'Cancel Soon',
      items: groups.cancelSoon,
      show: filter === 'all' || filter === 'cancel_soon',
    },
    {
      key: 'renewSoon',
      label: 'Renew Soon',
      items: groups.renewSoon,
      show: filter === 'all' || filter === 'active',
    },
    {
      key: 'trials',
      label: 'Trials Ending Soon',
      items: trialsSoon,
      show: filter === 'all' || filter === 'trials',
    },
    {
      key: 'active',
      label: 'Active Recurring',
      items: groups.active,
      show: filter === 'all' || filter === 'active',
    },
    {
      key: 'archived',
      label: 'Archived',
      items: groups.archived,
      show: filter === 'all' || filter === 'archived',
    },
  ]

  const visibleSections = sections.filter((s) => s.show)
  const hasAnyData = visibleSections.some((s) => s.items.length > 0)

  if (!hasAnyData && !search) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📡</div>
        <p className="empty-state-title">No subscriptions here yet</p>
        <p className="empty-state-hint">
          Click the SubRadar extension icon on any subscription page to start tracking.
        </p>
      </div>
    )
  }

  const hasAnyResults = visibleSections.some((s) => s.items.some((item) => matches(item, search)))

  if (search && !hasAnyResults) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <p className="empty-state-title">No results for "{search}"</p>
        <p className="empty-state-hint">Try a different service name or domain.</p>
      </div>
    )
  }

  return (
    <div>
      {visibleSections.map((section) => {
        const filtered = section.items.filter((item) => matches(item, search))
        const empty = SECTION_EMPTY[section.key]

        return (
          <div key={section.key} className="section">
            <div className="section-header">
              <h2 className="section-title">
                {SECTION_ICONS[section.key]} {section.label}
              </h2>
              <span className="section-count">{filtered.length}</span>
              <div className="section-divider" />
            </div>

            {filtered.length === 0 ? (
              <div className="section-empty">
                <span className="section-empty-icon" aria-hidden="true">{empty.icon}</span>
                <p className="section-empty-title">
                  {search ? `No results for "${search}" in this section` : empty.title}
                </p>
                {!search && <p className="section-empty-hint">{empty.hint}</p>}
              </div>
            ) : (
              <div className="section-grid">
                {filtered.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id}
                    subscription={sub}
                    onRefresh={onRefresh}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
