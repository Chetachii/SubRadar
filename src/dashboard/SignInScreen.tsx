import { useState } from 'react'
import { supabase } from '../lib/supabase'

async function googleSignIn() {
  const redirectTo = chrome.identity.getRedirectURL()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error || !data.url) {
    console.error('[SubRadar] OAuth URL error:', error)
    return
  }

  let callbackUrl: string | undefined
  try {
    callbackUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true })
  } catch (err) {
    // User cancelled or flow was blocked — not an error worth surfacing
    console.error('[SubRadar] launchWebAuthFlow:', err)
    return
  }

  if (!callbackUrl) return

  const url = new URL(callbackUrl)

  // PKCE flow — authorization code in query params (Supabase default)
  const code = url.searchParams.get('code')
  if (code) {
    const { error: ex } = await supabase.auth.exchangeCodeForSession(code)
    if (ex) console.error('[SubRadar] exchangeCodeForSession:', ex)
    return
  }

  // Implicit flow — tokens in hash fragment (fallback)
  const params = new URLSearchParams(url.hash.slice(1))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (access_token && refresh_token) {
    const { error: se } = await supabase.auth.setSession({ access_token, refresh_token })
    if (se) console.error('[SubRadar] setSession:', se)
  }
}

export default function SignInScreen() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [emailError, setEmailError] = useState('')

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEmailError('')
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setSending(false)
    if (error) {
      console.error('[SubRadar] signInWithOtp error:', error.status, error.message)
      const msg = error.message?.toLowerCase() ?? ''
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setEmailError('Too many attempts. Please wait a few minutes and try again.')
      } else if (msg.includes('invalid email') || msg.includes('unable to validate')) {
        setEmailError('Invalid email address.')
      } else {
        setEmailError(`Error: ${error.message}`)
      }
      return
    }
    setStep('code')
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setVerifying(true)
    setVerifyError('')

    const token = code.trim()

    // Try numeric OTP type first; fall back to magiclink token type for Supabase
    // projects that use the Magic Link template instead of a dedicated OTP template
    let { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })

    if (error) {
      const { error: mlError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: 'magiclink',
      })
      error = mlError
    }

    setVerifying(false)
    if (error) {
      console.error('[SubRadar] verifyOtp failed:', error)
      setVerifyError('Invalid or expired code. Try again.')
    }
    // on success: onAuthStateChange in main.tsx fires → <Dashboard /> renders automatically
  }

  return (
    <div className="signin-screen">
      <div className="signin-card">
        <div className="signin-header">
          <div className="signin-logo-row">
            <svg
              className="signin-logo-icon"
              viewBox="0 0 512 512"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="0" y="0" width="512" height="512" rx="112" fill="#2563EB" />
              <path d="M256 120 A150 150 0 1 1 106 270 L256 270 Z" fill="white" opacity="0.2" />
              <path d="M256 180 A90 90 0 1 1 166 270 L256 270 Z" fill="white" opacity="0.45" />
              <line x1="256" y1="270" x2="256" y2="110" stroke="white" strokeWidth="16" strokeLinecap="round" />
              <circle cx="256" cy="270" r="20" fill="white" />
              <circle cx="345" cy="170" r="28" fill="#FCD34D" />
            </svg>
            <h1 className="signin-title">SubRadar</h1>
          </div>
          <p className="signin-subtitle">
            Track free trials and subscriptions. Stay ahead of billing.
          </p>
        </div>

        <button className="btn signin-google-btn" onClick={googleSignIn}>
          <svg className="signin-google-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        <div className="signin-divider">
          <span className="signin-divider-text">or</span>
        </div>

        {step === 'email' ? (
          <form className="signin-magic-form" onSubmit={handleSendCode}>
            <div className="signin-field">
              <label className="signin-email-label" htmlFor="signin-email">Email</label>
              <input
                id="signin-email"
                className={`signin-email-input${emailError ? ' signin-email-input--error' : ''}`}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError('') }}
                required
                aria-label="Email address"
                aria-describedby={emailError ? 'signin-email-error' : undefined}
              />
              {emailError && <p className="signin-email-error" id="signin-email-error">{emailError}</p>}
            </div>
            <button
              className="btn btn--primary signin-btn"
              type="submit"
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <>
            <p className="signin-code-prompt">
              Enter the code sent to <strong>{email}</strong>
            </p>
            <form className="signin-magic-form" onSubmit={handleVerifyCode}>
              <input
                className="signin-email-input"
                type="text"
                maxLength={64}
                placeholder="Enter your code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                aria-label="Verification code"
                autoFocus
              />
              {verifyError && <p className="signin-verify-error">{verifyError}</p>}
              <button className="btn btn--primary signin-btn" type="submit" disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify code'}
              </button>
            </form>
            <button
              className="btn--back"
              onClick={() => { setStep('email'); setCode(''); setVerifyError('') }}
            >
              ← Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
