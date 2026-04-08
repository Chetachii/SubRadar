import type { Subscription } from '../types/subscription'
import { groupByIntent } from '../services/statusService'
import SubscriptionCard from './SubscriptionCard'
import { today } from '../utils/dates'
import { Ban as BanIcon, Bell as BellIcon, RotateCcw as RotateCcwIcon, Radio as RadioIcon, Search as SearchIcon, Archive as ArchiveIcon } from 'lucide-react'

type FilterTab = 'all' | 'cancel' | 'renew' | 'remind_before_billing' | 'archived'

interface Props {
  subscriptions: Subscription[]
  filter: FilterTab
  search: string
  onRefresh: () => void
}

const EMPTY_STATES: Record<FilterTab, { icon: React.ReactElement; title: string; hint: string }> = {
  all: {
    icon: <RadioIcon size={40} />,
    title: 'No subscriptions tracked yet',
    hint: 'Click the SubRadar extension icon on any subscription page to start tracking.',
  },
  cancel: {
    icon: <BanIcon size={40} />,
    title: 'No subscriptions to cancel',
    hint: 'Subscriptions you plan to cancel will appear here.',
  },
  renew: {
    icon: <RotateCcwIcon size={40} />,
    title: 'No subscriptions to renew',
    hint: 'Subscriptions you want to keep will appear here.',
  },
  remind_before_billing: {
    icon: <BellIcon size={40} />,
    title: 'No reminders set',
    hint: 'Subscriptions you want to decide on later will appear here.',
  },
  archived: {
    icon: <ArchiveIcon size={40} />,
    title: 'No archived subscriptions',
    hint: 'Subscriptions overdue by 7+ days are automatically archived here.',
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

export default function SubscriptionList({ subscriptions, filter, search, onRefresh }: Props) {
  const groups = groupByIntent(subscriptions)

  const unsorted: Subscription[] =
    filter === 'cancel' ? groups.cancel :
    filter === 'renew' ? groups.renew :
    filter === 'remind_before_billing' ? groups.remindBeforeBilling :
    filter === 'archived' ? subscriptions.filter((s) => s.status === 'archived') :
    [...groups.cancel, ...groups.renew, ...groups.remindBeforeBilling]

  const items = [...unsorted].sort((a, b) => {
    if (filter === 'all') {
      // Most recently added first
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
    }
    // Other tabs: soonest renewal first
    if (!a.renewalDate && !b.renewalDate) return 0
    if (!a.renewalDate) return 1
    if (!b.renewalDate) return -1
    return a.renewalDate < b.renewalDate ? -1 : a.renewalDate > b.renewalDate ? 1 : 0
  })

  const filtered = items.filter((item) => matches(item, search))

  if (items.length === 0 && !search) {
    const empty = EMPTY_STATES[filter]
    return (
      <div className="empty-state">
        <div className="empty-state-icon">{empty.icon}</div>
        <p className="empty-state-title">{empty.title}</p>
        <p className="empty-state-hint">{empty.hint}</p>
      </div>
    )
  }

  if (search && filtered.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><SearchIcon size={40} /></div>
        <p className="empty-state-title">No results for "{search}"</p>
        <p className="empty-state-hint">Try a different service name or domain.</p>
      </div>
    )
  }

  return (
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
  )
}
