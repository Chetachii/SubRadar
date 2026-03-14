import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import { groupBySection } from '../services/statusService'
import SubscriptionCard from './SubscriptionCard'

type FilterTab = 'all' | 'active' | 'cancel_soon' | 'archived'

interface Props {
  subscriptions: Subscription[]
  prefs: Preferences
  filter: FilterTab
  onRefresh: () => void
}

export default function SubscriptionList({ subscriptions, prefs, filter, onRefresh }: Props) {
  const groups = groupBySection(subscriptions, prefs)

  const sections = [
    { key: 'cancelSoon', label: 'Cancel Soon', items: groups.cancelSoon, show: filter === 'all' || filter === 'cancel_soon' },
    { key: 'renewSoon', label: 'Renew Soon', items: groups.renewSoon, show: filter === 'all' || filter === 'active' },
    { key: 'active', label: 'Active Recurring', items: groups.active, show: filter === 'all' || filter === 'active' },
    { key: 'archived', label: 'Archived', items: groups.archived, show: filter === 'all' || filter === 'archived' },
  ]

  const visibleSections = sections.filter((s) => s.show && s.items.length > 0)

  if (visibleSections.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No subscriptions here yet.</p>
        <p style={styles.emptyHint}>Click the extension icon to track a subscription.</p>
      </div>
    )
  }

  return (
    <div>
      {visibleSections.map((section) => (
        <div key={section.key} style={styles.section}>
          <h2 style={styles.sectionHeading}>{section.label}</h2>
          {section.items.map((sub) => (
            <SubscriptionCard key={sub.id} subscription={sub} onRefresh={onRefresh} />
          ))}
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  section: { marginBottom: '28px' },
  sectionHeading: { fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '10px' },
  empty: { textAlign: 'center', color: '#9ca3af', paddingTop: '40px' },
  emptyHint: { fontSize: '13px' },
}
