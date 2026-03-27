import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installChromeMock } from '../test/chromeMock'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { url: 'https://accounts.google.com/o/oauth2/auth?fake=1' },
        error: null,
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
  },
}))

import { supabase } from '../lib/supabase'
import SignInScreen from './SignInScreen'

beforeEach(() => {
  installChromeMock()
  vi.clearAllMocks()
  // Restore defaults cleared by clearAllMocks
  vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { url: 'https://accounts.google.com/o/oauth2/auth?fake=1' },
    error: null,
  } as never)
  vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.auth.setSession).mockResolvedValue({ data: {}, error: null } as never)
})

describe('SignInScreen — layout', () => {
  it('renders the SubRadar title', () => {
    render(<SignInScreen />)
    expect(screen.getByText('SubRadar')).toBeInTheDocument()
  })

  it('renders the Google sign-in button', () => {
    render(<SignInScreen />)
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('renders the "or" divider', () => {
    render(<SignInScreen />)
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('renders the email input and send code button', () => {
    render(<SignInScreen />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.getByText('Send code')).toBeInTheDocument()
  })
})

describe('SignInScreen — Google OAuth via launchWebAuthFlow', () => {
  it('calls signInWithOAuth with skipBrowserRedirect and the identity redirect URL', async () => {
    render(<SignInScreen />)
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://fake-id.chromiumapp.org/',
          skipBrowserRedirect: true,
        },
      }),
    )
  })

  it('calls launchWebAuthFlow with the URL returned by signInWithOAuth', async () => {
    render(<SignInScreen />)
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith({
        url: 'https://accounts.google.com/o/oauth2/auth?fake=1',
        interactive: true,
      }),
    )
  })

  it('calls exchangeCodeForSession when callback URL contains a code (PKCE)', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValueOnce(
      'https://fake-id.chromiumapp.org/?code=abc123',
    )
    render(<SignInScreen />)
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123'),
    )
  })

  it('calls setSession when callback URL contains tokens in hash (implicit)', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValueOnce(
      'https://fake-id.chromiumapp.org/#access_token=tok&refresh_token=ref&type=bearer',
    )
    render(<SignInScreen />)
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'tok',
        refresh_token: 'ref',
      }),
    )
  })

  it('does not throw when launchWebAuthFlow is cancelled', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockRejectedValueOnce(
      new Error('Authorization page could not be loaded'),
    )
    render(<SignInScreen />)
    // Should not throw
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled(),
    )
  })
})

describe('SignInScreen — OTP code flow', () => {
  it('calls signInWithOtp with email and no emailRedirectTo', async () => {
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() =>
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
      }),
    )
  })

  it('shows code entry form after sending', async () => {
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() =>
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument(),
    )
  })

  it('calls verifyOtp with email, token, and type', async () => {
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByText('Verify code'))
    await waitFor(() =>
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        token: '123456',
        type: 'email',
      }),
    )
  })

  it('shows error message when verifyOtp returns an error', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Token has expired or is invalid' } as never,
    } as never)

    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('000000'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByText('Verify code'))
    await waitFor(() =>
      expect(screen.getByText('Invalid or expired code. Try again.')).toBeInTheDocument(),
    )
  })

  it('resets to email step when clicking "Use a different email"', async () => {
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() => expect(screen.getByPlaceholderText('000000')).toBeInTheDocument())

    fireEvent.click(screen.getByText('← Use a different email'))
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('000000')).not.toBeInTheDocument()
  })

  it('trims whitespace from email before calling signInWithOtp', async () => {
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: '  user@example.com  ' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() =>
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@example.com' }),
      ),
    )
  })
})
