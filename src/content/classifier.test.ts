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
  it('is set to 5', () => {
    expect(CONFIDENCE_THRESHOLD).toBe(5)
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
})
