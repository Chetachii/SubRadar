import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './dashboard.css'
import Dashboard from './Dashboard'
import SignInScreen from './SignInScreen'
import { supabase } from '../lib/supabase'
import type { Session } from '@supabase/supabase-js'

function App() {
  // undefined = loading, null = unauthenticated, Session = authenticated
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return null  // suppress flash while checking
  return session ? <Dashboard /> : <SignInScreen />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)
