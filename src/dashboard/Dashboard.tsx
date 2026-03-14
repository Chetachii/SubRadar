import { useEffect, useState } from 'react'
import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import { listSubscriptions } from '../repository/subscriptionRepository'
import { getPreferences } from '../repository/preferencesRepository'
import SubscriptionList from './SubscriptionList'

type FilterTab = 'all' | 'active' | 'cancel_soon' | 'archived'

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    const [subs, p] = await Promise.all([listSubscriptions(), getPreferences()])
    setSubscriptions(subs)
    setPrefs(p)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'cancel_soon', label: 'Cancel Soon' },
    { value: 'archived', label: 'Archived' },
  ]

  if (loading) return <div style={styles.container}><p>Loading…</p></div>

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>SubRadar</h1>

      <div style={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            style={{ ...styles.tab, ...(filter === tab.value ? styles.tabActive : {}) }}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {prefs && (
        <SubscriptionList
          subscriptions={subscriptions}
          prefs={prefs}
          filter={filter}
          onRefresh={load}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '720px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: '24px', fontWeight: 700, margin: '0 0 20px' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' },
  tab: { background: 'none', border: 'none', padding: '6px 12px', cursor: 'pointer', fontSize: '14px', color: '#6b7280', borderRadius: '6px' },
  tabActive: { background: '#eff6ff', color: '#2563eb', fontWeight: 600 },
}
