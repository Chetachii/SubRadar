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
  vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { url: 'https://accounts.google.com/o/oauth2/auth?fake=1' },
    error: null,
  } as never)
  vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ data: {}, error: null } as never)
  vi.mocked(supabase.auth.setSession).mockResolvedValue({ data: {}, error: null } as never)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function advanceToCodeStep(email = 'user@example.com') {
  render(<SignInScreen />)
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: email },
  })
  fireEvent.click(screen.getByText('Send code'))
  await waitFor(() => expect(screen.getByPlaceholderText('Enter your code')).toBeInTheDocument())
}

// ─── Layout ───────────────────────────────────────────────────────────────────

describe('SignInScreen — layout', () => {
  it('renders the SubRadar title', () => {
    render(<SignInScreen />)
    expect(screen.getByText('SubRadar')).toBeInTheDocument()
  })

  it('renders the logo SVG beside the title', () => {
    render(<SignInScreen />)
    const logoRow = document.querySelector('.signin-logo-row')
    expect(logoRow).not.toBeNull()
    expect(logoRow!.querySelector('svg')).not.toBeNull()
    expect(logoRow!.querySelector('.signin-logo-icon')).not.toBeNull()
  })

  it('renders the tagline', () => {
    render(<SignInScreen />)
    expect(
      screen.getByText('Track free trials and subscriptions. Stay ahead of billing.'),
    ).toBeInTheDocument()
  })

  it('renders the Google sign-in button', () => {
    render(<SignInScreen />)
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
  })

  it('Google button uses outlined style, not filled primary', () => {
    render(<SignInScreen />)
    const btn = screen.getByText('Sign in with Google').closest('button')
    expect(btn?.className).toContain('signin-google-btn')
    expect(btn?.className).not.toContain('btn--primary')
  })

  it('Google button contains the Google G icon SVG', () => {
    render(<SignInScreen />)
    const btn = screen.getByText('Sign in with Google').closest('button')
    expect(btn?.querySelector('.signin-google-icon')).not.toBeNull()
  })

  it('renders the "or" divider', () => {
    render(<SignInScreen />)
    expect(screen.getByText('or')).toBeInTheDocument()
  })

  it('renders an "Email" label above the email input', () => {
    render(<SignInScreen />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    const label = screen.getByText('Email').closest('label') ?? screen.getByLabelText('Email address')
    expect(label).toBeInTheDocument()
  })

  it('renders the email input', () => {
    render(<SignInScreen />)
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('Send code button uses the primary style', () => {
    render(<SignInScreen />)
    const btn = screen.getByText('Send code').closest('button')
    expect(btn?.className).toContain('btn--primary')
  })
})

// ─── Email error state ─────────────────────────────────────────────────────────

describe('SignInScreen — email error state', () => {
  it('shows a rate-limit message when Supabase returns a rate-limit error', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { message: 'Email rate limit exceeded', status: 429 },
    } as never)
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() =>
      expect(
        screen.getByText(/too many attempts/i),
      ).toBeInTheDocument(),
    )
  })

  it('shows the actual error message for non-rate-limit errors', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { message: 'Signup is disabled', status: 422 },
    } as never)
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() =>
      expect(screen.getByText('Error: Signup is disabled')).toBeInTheDocument(),
    )
  })

  it('applies error styling to the email input when there is an error', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { message: 'Signup is disabled', status: 422 },
    } as never)
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() => {
      const input = screen.getByPlaceholderText('you@example.com')
      expect(input.className).toContain('signin-email-input--error')
    })
  })

  it('clears the error when the user changes the email input', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { message: 'Signup is disabled', status: 422 },
    } as never)
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() => screen.getByText('Error: Signup is disabled'))

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'other@example.com' },
    })
    expect(screen.queryByText('Error: Signup is disabled')).not.toBeInTheDocument()
  })

  it('does not advance to code step when signInWithOtp errors', async () => {
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValueOnce({
      data: {},
      error: { message: 'Something broke', status: 500 },
    } as never)
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() => screen.getByText('Error: Something broke'))
    expect(screen.queryByPlaceholderText('Enter your code')).not.toBeInTheDocument()
  })
})

// ─── OTP code flow ─────────────────────────────────────────────────────────────

describe('SignInScreen — OTP code flow', () => {
  it('calls signInWithOtp with the trimmed email', async () => {
    render(<SignInScreen />)
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: '  user@example.com  ' },
    })
    fireEvent.click(screen.getByText('Send code'))
    await waitFor(() =>
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'user@example.com' }),
    )
  })

  it('shows the code entry form after sending', async () => {
    await advanceToCodeStep()
    expect(screen.getByPlaceholderText('Enter your code')).toBeInTheDocument()
    expect(screen.getByText('Verify code')).toBeInTheDocument()
    expect(screen.getByText('← Use a different email')).toBeInTheDocument()
  })

  it('shows the email address in the code-step prompt', async () => {
    await advanceToCodeStep('me@example.com')
    expect(screen.getByText('me@example.com')).toBeInTheDocument()
  })

  it('code input does not restrict to numeric keyboard', async () => {
    await advanceToCodeStep()
    const input = screen.getByPlaceholderText('Enter your code')
    expect(input).not.toHaveAttribute('inputMode', 'numeric')
  })

  it('code input accepts up to 64 characters', async () => {
    await advanceToCodeStep()
    const input = screen.getByPlaceholderText('Enter your code')
    expect(input).toHaveAttribute('maxLength', '64')
  })

  it('tries verifyOtp with type="email" first', async () => {
    await advanceToCodeStep()
    fireEvent.change(screen.getByPlaceholderText('Enter your code'), {
      target: { value: 'abc12345' },
    })
    fireEvent.click(screen.getByText('Verify code'))
    await waitFor(() =>
      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'user@example.com',
        token: 'abc12345',
        type: 'email',
      }),
    )
  })

  it('falls back to type="magiclink" when type="email" fails', async () => {
    vi.mocked(supabase.auth.verifyOtp)
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Token has expired or is invalid' },
      } as never)
      .mockResolvedValueOnce({ data: {}, error: null } as never)

    await advanceToCodeStep()
    fireEvent.change(screen.getByPlaceholderText('Enter your code'), {
      target: { value: 'abc12345' },
    })
    fireEvent.click(screen.getByText('Verify code'))

    await waitFor(() => expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(2))
    expect(supabase.auth.verifyOtp).toHaveBeenNthCalledWith(1, {
      email: 'user@example.com',
      token: 'abc12345',
      type: 'email',
    })
    expect(supabase.auth.verifyOtp).toHaveBeenNthCalledWith(2, {
      email: 'user@example.com',
      token: 'abc12345',
      type: 'magiclink',
    })
  })

  it('shows error when both email and magiclink verification fail', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'invalid' },
    } as never)

    await advanceToCodeStep()
    fireEvent.change(screen.getByPlaceholderText('Enter your code'), {
      target: { value: 'badcode' },
    })
    fireEvent.click(screen.getByText('Verify code'))
    await waitFor(() =>
      expect(screen.getByText('Invalid or expired code. Try again.')).toBeInTheDocument(),
    )
  })

  it('does not show error when type="email" fails but magiclink succeeds', async () => {
    vi.mocked(supabase.auth.verifyOtp)
      .mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Token expired' },
      } as never)
      .mockResolvedValueOnce({ data: {}, error: null } as never)

    await advanceToCodeStep()
    fireEvent.change(screen.getByPlaceholderText('Enter your code'), {
      target: { value: 'abc12345' },
    })
    fireEvent.click(screen.getByText('Verify code'))
    await waitFor(() => expect(supabase.auth.verifyOtp).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Invalid or expired code. Try again.')).not.toBeInTheDocument()
  })

  it('resets to email step when clicking "Use a different email"', async () => {
    await advanceToCodeStep()
    fireEvent.click(screen.getByText('← Use a different email'))
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Enter your code')).not.toBeInTheDocument()
  })

  it('clears the code and error when going back to email step', async () => {
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'invalid' },
    } as never)

    await advanceToCodeStep()
    fireEvent.change(screen.getByPlaceholderText('Enter your code'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByText('Verify code'))
    await waitFor(() => screen.getByText('Invalid or expired code. Try again.'))

    fireEvent.click(screen.getByText('← Use a different email'))
    // Back on email step — no error visible
    expect(screen.queryByText('Invalid or expired code. Try again.')).not.toBeInTheDocument()
  })
})

// ─── Google OAuth ──────────────────────────────────────────────────────────────

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

  it('calls setSession when callback URL contains tokens in hash (implicit flow)', async () => {
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

  it('does not throw when launchWebAuthFlow is cancelled by the user', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockRejectedValueOnce(
      new Error('Authorization page could not be loaded'),
    )
    render(<SignInScreen />)
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled(),
    )
  })

  it('does not call exchangeCodeForSession when callbackUrl is undefined', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValueOnce(undefined as never)
    render(<SignInScreen />)
    fireEvent.click(screen.getByText('Sign in with Google'))
    await waitFor(() =>
      expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled(),
    )
  })
})
