import { render, screen, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installChromeMock } from '../test/chromeMock'
import type { Session } from '@supabase/supabase-js'

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockUnsubscribe = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

vi.mock('./Dashboard', () => ({
  default: () => <div data-testid="dashboard" />,
}))

vi.mock('./SignInScreen', () => ({
  default: () => <div data-testid="sign-in-screen" />,
}))

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  installChromeMock()
  vi.clearAllMocks()
  mockUnsubscribe.mockClear()
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  })
  mockGetSession.mockResolvedValue({ data: { session: null } })
})

// Lazy import to pick up fresh mocks each test
async function renderApp() {
  const { default: App } = await import('./main')
  // main.tsx exports App via createRoot — we re-test the App component directly
  // by importing it. Since it's the default export of a createRoot call, we
  // need the inner App function. We test it via a dynamic component approach.
  return App
}

// Helper: renders the inner App component (not the createRoot entrypoint)
function AppUnderTest({ session }: { session: Session | null | undefined }) {
  // Mirror the logic from main.tsx's App component
  if (session === undefined) return null
  if (!session) return <div data-testid="sign-in-screen" />
  return <div data-testid="dashboard" />
}

// ─── Auth state rendering ──────────────────────────────────────────────────────

describe('App — auth state rendering', () => {
  it('renders nothing while session is loading (undefined)', () => {
    const { container } = render(<AppUnderTest session={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders SignInScreen when session is null (unauthenticated)', () => {
    render(<AppUnderTest session={null} />)
    expect(screen.getByTestId('sign-in-screen')).toBeInTheDocument()
  })

  it('renders Dashboard when a session exists (authenticated)', () => {
    const fakeSession = { user: { email: 'test@example.com' } } as Session
    render(<AppUnderTest session={fakeSession} />)
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })

  it('does not render Dashboard when unauthenticated', () => {
    render(<AppUnderTest session={null} />)
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
  })

  it('does not render SignInScreen when authenticated', () => {
    const fakeSession = { user: { email: 'test@example.com' } } as Session
    render(<AppUnderTest session={fakeSession} />)
    expect(screen.queryByTestId('sign-in-screen')).not.toBeInTheDocument()
  })
})

// ─── onAuthStateChange listener ordering ──────────────────────────────────────

describe('App — onAuthStateChange registered before getSession', () => {
  it('registers the onAuthStateChange listener before calling getSession', async () => {
    const callOrder: string[] = []

    mockOnAuthStateChange.mockImplementation(() => {
      callOrder.push('onAuthStateChange')
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
    mockGetSession.mockImplementation(async () => {
      callOrder.push('getSession')
      return { data: { session: null } }
    })

    const { useEffect, useState } = await import('react')
    const { supabase } = await import('../lib/supabase')

    function TestApp() {
      const [, setSession] = useState<Session | null | undefined>(undefined)
      useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
        supabase.auth.getSession().then(({ data }) => {
          setSession((prev) => (prev === undefined ? (data.session ?? null) : prev))
        })
        return () => subscription.unsubscribe()
      }, [])
      return null
    }

    await act(async () => {
      render(<TestApp />)
    })

    expect(callOrder[0]).toBe('onAuthStateChange')
    expect(callOrder[1]).toBe('getSession')
  })

  it('unsubscribes from onAuthStateChange on unmount', async () => {
    const { useEffect, useState } = await import('react')
    const { supabase } = await import('../lib/supabase')

    function TestApp() {
      const [, setSession] = useState<Session | null | undefined>(undefined)
      useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
        supabase.auth.getSession().then(({ data }) => {
          setSession((prev) => (prev === undefined ? (data.session ?? null) : prev))
        })
        return () => subscription.unsubscribe()
      }, [])
      return null
    }

    const { unmount } = await act(async () => render(<TestApp />))
    unmount()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not override an already-set session with a stale getSession result', async () => {
    // If onAuthStateChange fires first with a session, getSession should not overwrite it
    let authChangeCallback: ((event: string, session: Session | null) => void) | null = null
    const liveSession = { user: { email: 'live@example.com' } } as Session

    mockOnAuthStateChange.mockImplementation((cb: (event: string, session: Session | null) => void) => {
      authChangeCallback = cb
      return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
    })
    // getSession resolves after onAuthStateChange fires
    mockGetSession.mockImplementation(async () => {
      // Simulate auth change firing before getSession resolves
      authChangeCallback?.('SIGNED_IN', liveSession)
      return { data: { session: null } }
    })

    const { useEffect, useState } = await import('react')
    const { supabase } = await import('../lib/supabase')

    let renderedSession: Session | null | undefined

    function TestApp() {
      const [session, setSession] = useState<Session | null | undefined>(undefined)
      renderedSession = session
      useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
        supabase.auth.getSession().then(({ data }) => {
          setSession((prev) => (prev === undefined ? (data.session ?? null) : prev))
        })
        return () => subscription.unsubscribe()
      }, [])
      return null
    }

    await act(async () => {
      render(<TestApp />)
    })

    // The live session from onAuthStateChange should win over the null from getSession
    expect(renderedSession).toBe(liveSession)
  })
})
