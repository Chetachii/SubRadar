import { describe, it, expect, beforeEach } from 'vitest'
import { hasBeenPrompted, markPrompted, clearPromptState } from './promptState'

beforeEach(() => {
  clearPromptState()
})

describe('hasBeenPrompted', () => {
  it('returns false for a URL that has not been prompted', () => {
    expect(hasBeenPrompted('https://example.com/pricing')).toBe(false)
  })

  it('returns true after markPrompted is called', () => {
    markPrompted('https://example.com/pricing')
    expect(hasBeenPrompted('https://example.com/pricing')).toBe(true)
  })

  it('normalizes URL to hostname + pathname', () => {
    markPrompted('https://example.com/pricing?ref=123')
    // Same host+path, different query → should NOT match (querystring stripped)
    expect(hasBeenPrompted('https://example.com/pricing')).toBe(true)
  })
})

describe('markPrompted', () => {
  it('allows same URL to be checked after marking', () => {
    markPrompted('https://netflix.com/subscribe')
    expect(hasBeenPrompted('https://netflix.com/subscribe')).toBe(true)
  })

  it('different URLs are tracked independently', () => {
    markPrompted('https://netflix.com/pricing')
    expect(hasBeenPrompted('https://spotify.com/pricing')).toBe(false)
  })
})

describe('clearPromptState', () => {
  it('clears all tracked URLs', () => {
    markPrompted('https://netflix.com/pricing')
    markPrompted('https://spotify.com/pricing')
    clearPromptState()
    expect(hasBeenPrompted('https://netflix.com/pricing')).toBe(false)
    expect(hasBeenPrompted('https://spotify.com/pricing')).toBe(false)
  })
})
