import { useEffect, useState, useMemo } from 'react'
import type { Subscription } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import { listSubscriptions } from '../repository/subscriptionRepository'
import { getPreferences } from '../repository/preferencesRepository'
import SubscriptionList from './SubscriptionList'
import { List as ListIcon, Timer as TimerIcon, XCircle as XCircleIcon, RotateCcw as RotateCcwIcon, X as XIcon, Search as SearchIcon } from 'lucide-react'

const SEED_DATA: Omit<Subscription, never>[] = [
  {
    id: 'seed-1', serviceName: 'Netflix', sourceDomain: 'netflix.com',
    cost: 15.99, currency: 'USD', billingFrequency: 'monthly',
    renewalDate: '2026-04-15', intent: 'renew_automatically', status: 'active',
    detectionSource: 'manual_entry', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed-2', serviceName: 'Spotify', sourceDomain: 'spotify.com',
    cost: 9.99, currency: 'USD', billingFrequency: 'monthly',
    renewalDate: '2026-03-20', intent: 'remind_before_billing', status: 'renew_soon',
    detectionSource: 'auto_detected', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed-3', serviceName: 'Adobe Creative Cloud', sourceDomain: 'adobe.com',
    cost: 54.99, currency: 'USD', billingFrequency: 'monthly',
    trialEndDate: '2026-03-25', intent: 'cancel_before_trial_ends', status: 'cancel_soon',
    detectionSource: 'auto_detected', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed-4', serviceName: 'GitHub Copilot', sourceDomain: 'github.com',
    cost: 10.00, currency: 'USD', billingFrequency: 'monthly',
    trialEndDate: '2026-03-22', renewalDate: '2026-04-22',
    intent: 'undecided', status: 'active',
    detectionSource: 'auto_detected', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

async function seedTestData() {
  await chrome.storage.local.set({ subscriptions: SEED_DATA })
  window.location.reload()
}

async function clearTestData() {
  await chrome.storage.local.remove('subscriptions')
  window.location.reload()
}

type FilterTab = 'all' | 'active' | 'trials' | 'cancel_soon' | 'archived'

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trials', label: 'Trials' },
  { value: 'cancel_soon', label: 'Cancel Soon' },
  { value: 'archived', label: 'Archived' },
]

function LoadingSkeleton() {
  return (
    <div className="skeleton">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-avatar" />
          <div className="skeleton-lines">
            <div className="skeleton-line skeleton-line--title" />
            <div className="skeleton-line skeleton-line--meta" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  )
}

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    const [subs, p] = await Promise.all([listSubscriptions(), getPreferences()])
    setSubscriptions(subs)
    setPrefs(p)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(() => {
    const now = Date.now()
    const live = subscriptions.filter((s) => s.status !== 'archived' && s.status !== 'canceled')
    return {
      active: live.length,
      trialsSoon: live.filter((s) => {
        if (!s.trialEndDate) return false
        const diff = new Date(s.trialEndDate).getTime() - now
        return diff >= 0 && diff <= FOURTEEN_DAYS_MS
      }).length,
      markedCancel: live.filter((s) => s.intent === 'cancel_before_trial_ends').length,
      markedRenew: live.filter(
        (s) => s.intent === 'remind_before_billing' || s.intent === 'renew_automatically',
      ).length,
    }
  }, [subscriptions])

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-row">
          <div>
            <h1 className="dashboard-title">SubRadar</h1>
            <p className="dashboard-subtitle">Track, manage, and stay ahead of your subscriptions</p>
          </div>
          <div className="dev-tools">
            <button className="btn btn--ghost" onClick={seedTestData}>Seed test data</button>
            <button className="btn btn--ghost" onClick={clearTestData}>Clear</button>
          </div>
        </div>
      </header>

      {!loading && (
        <div className="summary-grid">
          <div className="summary-card summary-card--total">
            <div className="summary-icon-wrap"><ListIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{summary.active}</div>
              <div className="summary-label">Active subscriptions</div>
            </div>
          </div>
          <div className="summary-card summary-card--trials">
            <div className="summary-icon-wrap"><TimerIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{summary.trialsSoon}</div>
              <div className="summary-label">Trials ending soon</div>
            </div>
          </div>
          <div className="summary-card summary-card--cancel">
            <div className="summary-icon-wrap"><XCircleIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{summary.markedCancel}</div>
              <div className="summary-label">Marked for cancellation</div>
            </div>
          </div>
          <div className="summary-card summary-card--renew">
            <div className="summary-icon-wrap"><RotateCcwIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{summary.markedRenew}</div>
              <div className="summary-label">Marked for renewal</div>
            </div>
          </div>
        </div>
      )}

      <div className="search-bar">
        <span className="search-icon" aria-hidden="true">
          <SearchIcon size={15} />
        </span>
        <input
          className="search-input"
          type="search"
          placeholder="Search subscriptions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search subscriptions"
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
            <XIcon size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="filter-bar">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`filter-tab ${filter === tab.value ? 'filter-tab--active' : ''}`}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        prefs && (
          <SubscriptionList
            subscriptions={subscriptions}
            prefs={prefs}
            filter={filter}
            search={search}
            onRefresh={load}
          />
        )
      )}
    </div>
  )
}
