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

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)
    await supabase.auth.signInWithOtp({ email: email.trim() })
    setSending(false)
    setStep('code')
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setVerifying(true)
    setVerifyError('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setVerifying(false)
    if (error) setVerifyError('Invalid or expired code. Try again.')
    // on success: onAuthStateChange in main.tsx fires → <Dashboard /> renders automatically
  }

  return (
    <div className="signin-screen">
      <div className="signin-card">
        <h1 className="signin-title">SubRadar</h1>
        <p className="signin-subtitle">
          Track free trials and subscriptions. Stay ahead of billing.
        </p>

        <button className="btn btn--primary signin-btn" onClick={googleSignIn}>
          Sign in with Google
        </button>

        <div className="signin-divider">
          <span className="signin-divider-text">or</span>
        </div>

        {step === 'email' ? (
          <form className="signin-magic-form" onSubmit={handleSendCode}>
            <input
              className="signin-email-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email address"
            />
            <button
              className="btn btn--secondary signin-btn"
              type="submit"
              disabled={sending}
            >
              {sending ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <>
            <p className="signin-code-prompt">
              Enter the 8-digit code sent to <strong>{email}</strong>
            </p>
            <form className="signin-magic-form" onSubmit={handleVerifyCode}>
              <input
                className="signin-email-input"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="00000000"
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
