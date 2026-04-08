import { StrictMode, useEffect, useState, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './dashboard.css'
import Dashboard from './Dashboard'
import SignInScreen from './SignInScreen'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean; error: string }> {
  state = { crashed: false, error: '' }
  static getDerivedStateFromError(e: Error) { return { crashed: true, error: e?.message ?? String(e) } }
  componentDidCatch(e: Error) { console.error('[SubRadar] Render crash:', e) }
  render() {
    if (this.state.crashed) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui', color: '#6b7280', flexDirection: 'column', gap: 8, padding: 24 }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>Something went wrong.</p>
          <p style={{ margin: 0, fontSize: 13, maxWidth: 480, textAlign: 'center', wordBreak: 'break-word' }}>{this.state.error}</p>
          <button style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14 }} onClick={() => window.location.reload()}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  // undefined = loading, null = unauthenticated, Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // Listener must be registered before getSession so no SIGNED_IN event is missed
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    supabase.auth.getSession().then(({ data }) => {
      setSession((prev) => (prev === undefined ? (data.session ?? null) : prev))
    }).catch(() => {
      setSession((prev) => (prev === undefined ? null : prev))
    })

    // Safety net: if auth check hangs (e.g. service worker sleeping), show sign-in after 3s
    const timeout = setTimeout(() => {
      setSession((prev) => (prev === undefined ? null : prev))
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  if (session === undefined) return null
  return session ? <Dashboard /> : <SignInScreen />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
