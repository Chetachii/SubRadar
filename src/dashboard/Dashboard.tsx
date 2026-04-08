import { useEffect, useState, useMemo, useRef } from 'react'
import type { Subscription } from '../types/subscription'
import { listSubscriptions } from '../repository/subscriptionRepository'
import SubscriptionList from './SubscriptionList'
import { getPreferences } from '../repository/preferencesRepository'
import type { Preferences } from '../types/preferences'
import { Ban as BanIcon, Bell as BellIcon, RotateCcw as RotateCcwIcon, X as XIcon, Search as SearchIcon, LogOut as LogOutIcon } from 'lucide-react'
import NotificationBell from './NotificationBell'
import { supabase } from '../lib/supabase'

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

type FilterTab = 'all' | 'cancel' | 'renew' | 'remind_before_billing' | 'archived'

const TABS: { value: FilterTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'cancel', label: 'Cancel' },
  { value: 'renew', label: 'Renew' },
  { value: 'remind_before_billing', label: 'Remind Before Billing' },
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

export default function Dashboard() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [userEmail, setUserEmail] = useState<string | undefined>()

  async function load() {
    setLoading(true)
    try {
      const [subs, loadedPrefs] = await Promise.all([listSubscriptions(), getPreferences()])
      setSubscriptions(subs)
      setPrefs(loadedPrefs)
    } catch (err) {
      console.error('[SubRadar] Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email)).catch(() => {})
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    // onAuthStateChange in main.tsx flips to <SignInScreen />
  }

  useEffect(() => {
    load()
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(load, 300)
    }
    document.addEventListener('visibilitychange', onVisible)

    // Reload when the background scan completes (it stamps runtimeMeta after every scan)
    const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.runtimeMeta) load()
    }
    chrome.storage.onChanged.addListener(onStorageChanged)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      chrome.storage.onChanged.removeListener(onStorageChanged)
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [])

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
          <div className="dashboard-title-row">
            <svg className="dashboard-logo-icon" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="0" y="0" width="512" height="512" rx="112" fill="#2563EB" />
              <path d="M256 120 A150 150 0 1 1 106 270 L256 270 Z" fill="white" opacity="0.2" />
              <path d="M256 180 A90 90 0 1 1 166 270 L256 270 Z" fill="white" opacity="0.45" />
              <line x1="256" y1="270" x2="256" y2="110" stroke="white" strokeWidth="16" strokeLinecap="round" />
              <circle cx="256" cy="270" r="20" fill="white" />
              <circle cx="345" cy="170" r="28" fill="#FCD34D" />
            </svg>
            <div>
              <h1 className="dashboard-title">SubRadar</h1>
              <p className="dashboard-subtitle">Track free trials and subscriptions. Stay ahead of billing.</p>
            </div>
          </div>
          <div className="dashboard-header-actions">
            <NotificationBell subscriptions={subscriptions} prefs={prefs} onRefresh={load} />
            <button
              className="dashboard-icon-btn"
              onClick={handleSignOut}
              aria-label="Sign out"
              data-tooltip="Sign out"
            >
              <LogOutIcon size={16} />
            </button>
            {userEmail && (
              <div
                className="dashboard-avatar"
                data-tooltip={userEmail}
                aria-label={userEmail}
              >
                {userEmail[0].toUpperCase()}
              </div>
            )}
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
