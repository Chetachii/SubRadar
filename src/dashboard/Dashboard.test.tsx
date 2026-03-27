import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installChromeMock } from '../test/chromeMock'

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: 'chetachi@example.com' } },
      }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('../repository/subscriptionRepository', () => ({
  listSubscriptions: vi.fn().mockResolvedValue([]),
}))

vi.mock('../repository/preferencesRepository', () => ({
  getPreferences: vi.fn().mockResolvedValue({
    notificationsEnabled: true,
    reminderLeadDays: 3,
    promptCooldownHours: 24,
    defaultSort: 'renewal_date',
  }),
}))

vi.mock('./NotificationBell', () => ({
  default: ({ subscriptions }: { subscriptions: unknown[] }) => (
    <button
      className="notif-bell-btn"
      aria-label="Notifications"
      data-tooltip="Notifications"
      data-testid="notification-bell"
    >
      🔔 {subscriptions.length}
    </button>
  ),
}))

vi.mock('./SubscriptionList', () => ({
  default: () => <div data-testid="subscription-list" />,
}))

import { supabase } from '../lib/supabase'
import { listSubscriptions } from '../repository/subscriptionRepository'
import Dashboard from './Dashboard'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  installChromeMock()
  // Dashboard uses chrome.storage.onChanged — add to mock
  ;(globalThis as unknown as { chrome: { storage: { onChanged: { addListener: ReturnType<typeof vi.fn>; removeListener: ReturnType<typeof vi.fn> } } } }).chrome.storage.onChanged = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }
  vi.clearAllMocks()
  vi.mocked(supabase.auth.getUser).mockResolvedValue({
    data: { user: { email: 'chetachi@example.com' } },
  } as never)
  vi.mocked(supabase.auth.signOut).mockResolvedValue({} as never)
  vi.mocked(listSubscriptions).mockResolvedValue([])
})

// ─── Header — branding ────────────────────────────────────────────────────────

describe('Dashboard — header branding', () => {
  it('renders the SubRadar title', async () => {
    render(<Dashboard />)
    expect(screen.getByText('SubRadar')).toBeInTheDocument()
  })

  it('renders the logo SVG beside the title in a title row', async () => {
    render(<Dashboard />)
    const titleRow = document.querySelector('.dashboard-title-row')
    expect(titleRow).not.toBeNull()
    expect(titleRow!.querySelector('svg.dashboard-logo-icon')).not.toBeNull()
    expect(titleRow!.querySelector('h1')).not.toBeNull()
  })

  it('renders the dashboard subtitle', async () => {
    render(<Dashboard />)
    expect(
      screen.getByText('Track free trials and subscriptions. Stay ahead of billing.'),
    ).toBeInTheDocument()
  })
})

// ─── Header — actions ─────────────────────────────────────────────────────────

describe('Dashboard — header actions', () => {
  it('renders the notification bell', async () => {
    render(<Dashboard />)
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument()
  })

  it('notification bell has data-tooltip="Notifications"', async () => {
    render(<Dashboard />)
    expect(screen.getByTestId('notification-bell')).toHaveAttribute(
      'data-tooltip',
      'Notifications',
    )
  })

  it('renders the logout button with data-tooltip="Sign out"', async () => {
    render(<Dashboard />)
    const btn = screen.getByRole('button', { name: /sign out/i })
    expect(btn).toHaveAttribute('data-tooltip', 'Sign out')
  })

  it('logout button and notification bell are siblings, not nested in a shared wrapper', async () => {
    render(<Dashboard />)
    const actionsContainer = document.querySelector('.dashboard-header-actions')
    expect(actionsContainer).not.toBeNull()
    // Should NOT have a .dashboard-toolbar child
    expect(actionsContainer!.querySelector('.dashboard-toolbar')).toBeNull()
  })

  it('does not render a "Seed test data" button', async () => {
    render(<Dashboard />)
    expect(screen.queryByText(/seed test data/i)).not.toBeInTheDocument()
  })

  it('does not render a "Clear" dev-tools button', async () => {
    render(<Dashboard />)
    // The search clear (×) button is only visible when there's a search term,
    // so querying for the dev "Clear" text is safe here
    expect(screen.queryByText('Clear')).not.toBeInTheDocument()
  })
})

// ─── Profile avatar ───────────────────────────────────────────────────────────

describe('Dashboard — profile avatar', () => {
  it('renders the avatar with the first letter of the user email uppercased', async () => {
    render(<Dashboard />)
    await waitFor(() => expect(screen.getByText('C')).toBeInTheDocument())
  })

  it('avatar has a data-tooltip with the full email address', async () => {
    render(<Dashboard />)
    await waitFor(() => {
      const avatar = document.querySelector('.dashboard-avatar')
      expect(avatar).not.toBeNull()
      expect(avatar).toHaveAttribute('data-tooltip', 'chetachi@example.com')
    })
  })

  it('does not render the avatar when no user is returned', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
    } as never)
    render(<Dashboard />)
    await waitFor(() => {
      expect(document.querySelector('.dashboard-avatar')).toBeNull()
    })
  })
})

// ─── Sign out ─────────────────────────────────────────────────────────────────

describe('Dashboard — sign out', () => {
  it('calls supabase.auth.signOut when the logout button is clicked', async () => {
    render(<Dashboard />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => expect(supabase.auth.signOut).toHaveBeenCalledTimes(1))
  })
})

// ─── Data loading ─────────────────────────────────────────────────────────────

describe('Dashboard — data loading', () => {
  it('calls listSubscriptions on mount', async () => {
    render(<Dashboard />)
    await waitFor(() => expect(listSubscriptions).toHaveBeenCalledTimes(1))
  })

  it('shows the subscription list after loading', async () => {
    render(<Dashboard />)
    await waitFor(() => expect(screen.getByTestId('subscription-list')).toBeInTheDocument())
  })

  it('shows the summary grid once loading is complete', async () => {
    render(<Dashboard />)
    await waitFor(() => expect(document.querySelector('.summary-grid')).not.toBeNull())
  })

  it('shows filter tabs', async () => {
    render(<Dashboard />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument()
    })
  })

  it('renders the search input', async () => {
    render(<Dashboard />)
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search subscriptions…')).toBeInTheDocument(),
    )
  })
})
