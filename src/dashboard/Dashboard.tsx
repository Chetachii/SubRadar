import { useEffect, useState, useMemo, useRef } from 'react'
import type { Subscription } from '../types/subscription'
import { listSubscriptions } from '../repository/subscriptionRepository'
import SubscriptionList from './SubscriptionList'
import { Ban as BanIcon, Bell as BellIcon, RotateCcw as RotateCcwIcon, X as XIcon, Search as SearchIcon } from 'lucide-react'

function useCountUp(target: number) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    cancelAnimationFrame(rafRef.current)
    if (target === 0) { setValue(0); return }
    const duration = 550
    const start = Date.now()
    function tick() {
      const t = Math.min((Date.now() - start) / duration, 1)
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setValue(Math.round(eased * target))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])
  return value
}

type FilterTab = 'all' | 'cancel' | 'renew' | 'remind_before_billing'

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cancel', label: 'Cancel' },
  { value: 'renew', label: 'Renew' },
  { value: 'remind_before_billing', label: 'Remind Before Billing' },
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

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const subs = await listSubscriptions()
      setSubscriptions(subs)
    } catch (err) {
      console.error('[SubRadar] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function seedTestData() {
    const today = new Date()
    const addDays = (n: number) => {
      const d = new Date(today)
      d.setDate(d.getDate() + n)
      return d.toISOString().split('T')[0]
    }
    const now = new Date().toISOString()
    const data: Subscription[] = [
      { id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        serviceName: 'Adobe Creative Cloud', sourceDomain: 'adobe.com',
        cost: 54.99, currency: 'USD', billingFrequency: 'monthly',
        renewalDate: addDays(3), intent: 'cancel', status: 'active',
        detectionSource: 'auto_detected' },
      { id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        serviceName: 'Spotify', sourceDomain: 'spotify.com',
        cost: 9.99, currency: 'USD', billingFrequency: 'monthly',
        renewalDate: addDays(5), intent: 'remind_before_billing', status: 'active',
        detectionSource: 'auto_detected' },
      { id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        serviceName: 'GitHub Copilot', sourceDomain: 'github.com',
        cost: 10.00, currency: 'USD', billingFrequency: 'monthly',
        trialEndDate: addDays(10), renewalDate: addDays(12), intent: 'cancel', status: 'active',
        detectionSource: 'auto_detected' },
      { id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        serviceName: 'Netflix', sourceDomain: 'netflix.com',
        cost: 15.99, currency: 'USD', billingFrequency: 'monthly',
        renewalDate: addDays(28), intent: 'renew', status: 'active',
        detectionSource: 'manual_entry' },
      { id: crypto.randomUUID(), createdAt: now, updatedAt: now,
        serviceName: 'Hulu', sourceDomain: 'hulu.com',
        cost: 7.99, currency: 'USD', billingFrequency: 'monthly',
        renewalDate: addDays(20), intent: 'remind_before_billing', status: 'active',
        detectionSource: 'auto_detected' },
    ]
    await chrome.storage.local.set({ subscriptions: data })
    load()
  }

  async function clearTestData() {
    await chrome.storage.local.set({ subscriptions: [] })
    load()
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(() => {
    const live = subscriptions.filter((s) => s.status !== 'archived' && s.status !== 'canceled')
    return {
      cancel: live.filter((s) => s.intent === 'cancel').length,
      renew: live.filter((s) => s.intent === 'renew').length,
      remind: live.filter((s) => s.intent === 'remind_before_billing').length,
    }
  }, [subscriptions])

  const cancelCount = useCountUp(summary.cancel)
  const renewCount = useCountUp(summary.renew)
  const remindCount = useCountUp(summary.remind)

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
          <div className="summary-card summary-card--cancel">
            <div className="summary-icon-wrap"><BanIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{cancelCount}</div>
              <div className="summary-label">Cancel</div>
            </div>
          </div>
          <div className="summary-card summary-card--renew">
            <div className="summary-icon-wrap"><RotateCcwIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{renewCount}</div>
              <div className="summary-label">Renew</div>
            </div>
          </div>
          <div className="summary-card summary-card--remind">
            <div className="summary-icon-wrap"><BellIcon size={22} aria-hidden="true" /></div>
            <div className="summary-text">
              <div className="summary-value">{remindCount}</div>
              <div className="summary-label">Remind Before Billing</div>
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
        <SubscriptionList
          subscriptions={subscriptions}
          filter={filter}
          search={search}
          onRefresh={load}
        />
      )}
    </div>
  )
}
