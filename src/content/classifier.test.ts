import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { classifyPage, CONFIDENCE_THRESHOLD } from './classifier'

function setLocation(href: string) {
  vi.stubGlobal('location', { href, hostname: new URL(href).hostname })
}

function setBodyText(text: string) {
  document.body.innerHTML = `<div>${text}</div>`
}

beforeEach(() => {
  document.body.innerHTML = ''
  document.title = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CONFIDENCE_THRESHOLD', () => {
  it('is set to 7', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(7)
  })
})

describe('classifyPage', () => {
  it('returns score 0 for a plain page with no signals', () => {
    setLocation('https://example.com/home')
    setBodyText('Welcome to our website')
    const { score } = classifyPage()
    expect(score).toBe(0)
  })

  it('adds 2 points for matching URL pattern /pricing', () => {
    setLocation('https://example.com/pricing')
    const { score, matchedSignals } = classifyPage()
    expect(score).toBeGreaterThanOrEqual(2)
    expect(matchedSignals).toContain('url_pattern')
  })

  it('adds 2 points for matching URL pattern /checkout', () => {
    setLocation('https://example.com/checkout')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('adds 2 points for matching URL pattern /plans', () => {
    setLocation('https://example.com/plans')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('adds 3 points for trial language in body', () => {
    setLocation('https://example.com/home')
    setBodyText('Start your free trial today')
    const { score, matchedSignals } = classifyPage()
    expect(score).toBeGreaterThanOrEqual(3)
    expect(matchedSignals).toContain('trial_language')
  })

  it('adds 2 points for pricing signals', () => {
    setLocation('https://example.com/home')
    setBodyText('Only $9.99 per month')
    const { score, matchedSignals } = classifyPage()
    expect(score).toBeGreaterThanOrEqual(2)
    expect(matchedSignals).toContain('pricing_block')
  })

  it('adds 3 points for subscription CTA', () => {
    setLocation('https://example.com/home')
    setBodyText('Subscribe now and save')
    const { score, matchedSignals } = classifyPage()
    expect(score).toBeGreaterThanOrEqual(3)
    expect(matchedSignals).toContain('subscription_cta')
  })

  it('adds 3 points for checkout provider in URL', () => {
    setLocation('https://stripe.com/checkout/session')
    const { score, matchedSignals } = classifyPage()
    expect(score).toBeGreaterThanOrEqual(3)
    expect(matchedSignals).toContain('checkout_provider')
  })

  it('accumulates signals above threshold', () => {
    setLocation('https://example.com/pricing')
    setBodyText('free trial per month')
    const { score } = classifyPage()
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD)
  })

  it('does not double-count same signal category', () => {
    setLocation('https://example.com/home')
    setBodyText('free trial start free trial try for free')
    const { matchedSignals } = classifyPage()
    const trialCount = matchedSignals.filter((s) => s === 'trial_language').length
    expect(trialCount).toBe(1)
  })

  it('matches /subscribe URL pattern', () => {
    setLocation('https://example.com/subscribe')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('matches /trial URL pattern', () => {
    setLocation('https://example.com/trial')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('matches /upgrade URL pattern', () => {
    setLocation('https://example.com/upgrade')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('detects pricing signal /year', () => {
    setLocation('https://example.com')
    setBodyText('$99/year billed now')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('pricing_block')
  })

  it('detects choose plan CTA', () => {
    setLocation('https://example.com')
    setBodyText('Choose plan that works for you')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('subscription_cta')
  })

  it('returns empty matchedSignals for no signals', () => {
    setLocation('https://example.com')
    setBodyText('Hello world')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toHaveLength(0)
  })

  // New URL patterns
  it('matches /premium URL pattern', () => {
    setLocation('https://www.spotify.com/us/premium/')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('matches /signup URL pattern', () => {
    setLocation('https://www.netflix.com/signup')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('matches /join URL pattern', () => {
    setLocation('https://example.com/join')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  it('matches /account/upgrade URL pattern via /upgrade token', () => {
    setLocation('https://example.com/account/upgrade')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('url_pattern')
  })

  // New CTAs
  it('detects get premium CTA', () => {
    setLocation('https://example.com')
    setBodyText('Get Premium and listen without ads')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('subscription_cta')
  })

  it('detects go premium CTA', () => {
    setLocation('https://example.com')
    setBodyText('Go Premium today for unlimited access')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('subscription_cta')
  })

  it('detects try free CTA', () => {
    setLocation('https://example.com')
    setBodyText('Try free for 30 days, cancel anytime')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('subscription_cta')
  })

  it('detects join now CTA', () => {
    setLocation('https://example.com')
    setBodyText('Join now and start your membership')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('subscription_cta')
  })

  it('detects start free CTA', () => {
    setLocation('https://example.com')
    setBodyText('Start free, upgrade when ready')
    const { matchedSignals } = classifyPage()
    expect(matchedSignals).toContain('subscription_cta')
  })

  // Real-service scenarios
  describe('Spotify /premium', () => {
    it('scores >= 7 with typical Premium page content', () => {
      // URL: /premium (+2), CTA: "get premium" (+3), pricing: "/month" (+2) = 7
      setLocation('https://www.spotify.com/us/premium/')
      setBodyText('Get Premium $9.99/month. Listen without ads. Cancel anytime.')
      const { score } = classifyPage()
      expect(score).toBeGreaterThanOrEqual(7)
    })

    it('matches url_pattern, subscription_cta, and pricing_block signals', () => {
      setLocation('https://www.spotify.com/us/premium/')
      setBodyText('Get Premium $9.99/month. Listen without ads. Cancel anytime.')
      const { matchedSignals } = classifyPage()
      expect(matchedSignals).toContain('url_pattern')
      expect(matchedSignals).toContain('subscription_cta')
      expect(matchedSignals).toContain('pricing_block')
    })
  })

  describe('Netflix /signup', () => {
    it('scores >= 7 with typical signup page content', () => {
      // URL: /signup (+2), CTA: "get started" (+3), pricing: "/month" (+2) = 7
      setLocation('https://www.netflix.com/signup')
      setBodyText('Get Started. $15.49/month. Watch anywhere. Cancel anytime.')
      const { score } = classifyPage()
      expect(score).toBeGreaterThanOrEqual(7)
    })

    it('matches url_pattern, subscription_cta, and pricing_block signals', () => {
      setLocation('https://www.netflix.com/signup')
      setBodyText('Get Started. $15.49/month. Watch anywhere. Cancel anytime.')
      const { matchedSignals } = classifyPage()
      expect(matchedSignals).toContain('url_pattern')
      expect(matchedSignals).toContain('subscription_cta')
      expect(matchedSignals).toContain('pricing_block')
    })
  })

  describe('GitHub /pricing', () => {
    it('scores >= 7 with typical pricing page content', () => {
      // URL: /pricing (+2), CTA: "get started" (+3), pricing: "/month" (+2) = 7
      setLocation('https://github.com/pricing')
      setBodyText('Get started for free. $4/month per user. Upgrade anytime.')
      const { score } = classifyPage()
      expect(score).toBeGreaterThanOrEqual(7)
    })

    it('matches url_pattern, subscription_cta, and pricing_block signals', () => {
      setLocation('https://github.com/pricing')
      setBodyText('Get started for free. $4/month per user. Upgrade anytime.')
      const { matchedSignals } = classifyPage()
      expect(matchedSignals).toContain('url_pattern')
      expect(matchedSignals).toContain('subscription_cta')
      expect(matchedSignals).toContain('pricing_block')
    })
  })
})
