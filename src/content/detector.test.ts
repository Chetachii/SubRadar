import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./classifier', () => ({
  classifyPage: vi.fn(),
  CONFIDENCE_THRESHOLD: 5,
}))

vi.mock('./extractor', () => ({
  extractSignals: vi.fn(),
}))

import { runDetection } from './detector'
import * as classifier from './classifier'
import * as extractor from './extractor'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('location', {
    href: 'https://example.com/pricing',
    hostname: 'example.com',
  })
})

describe('runDetection', () => {
  it('returns null when score is below threshold', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({ score: 3, matchedSignals: [] })
    expect(runDetection()).toBeNull()
  })

  it('returns null when score equals threshold minus 1', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({ score: 4, matchedSignals: [] })
    expect(runDetection()).toBeNull()
  })

  it('returns DetectionResult when score meets threshold', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({
      score: 5,
      matchedSignals: ['url_pattern', 'trial_language'],
    })
    vi.mocked(extractor.extractSignals).mockReturnValue({
      serviceName: 'Netflix',
      price: 9.99,
      currency: 'USD',
      billingFrequency: 'monthly',
      trialDurationDays: 14,
    })

    const result = runDetection()
    expect(result).not.toBeNull()
    expect(result!.confidenceScore).toBe(5)
    expect(result!.matchedSignals).toEqual(['url_pattern', 'trial_language'])
    expect(result!.serviceName).toBe('Netflix')
    expect(result!.price).toBe(9.99)
  })

  it('includes pageUrl and sourceDomain', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({ score: 8, matchedSignals: [] })
    vi.mocked(extractor.extractSignals).mockReturnValue({})

    const result = runDetection()
    expect(result!.pageUrl).toBe('https://example.com/pricing')
    expect(result!.sourceDomain).toBe('example.com')
  })

  it('does not call extractSignals when score is too low', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({ score: 2, matchedSignals: [] })
    runDetection()
    expect(extractor.extractSignals).not.toHaveBeenCalled()
  })

  it('spreads extractor signals onto result', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({ score: 6, matchedSignals: ['pricing_block'] })
    vi.mocked(extractor.extractSignals).mockReturnValue({ trialDurationDays: 30 })

    const result = runDetection()
    expect(result!.trialDurationDays).toBe(30)
  })

  it('returns result when score is exactly at threshold', () => {
    vi.mocked(classifier.classifyPage).mockReturnValue({ score: 5, matchedSignals: [] })
    vi.mocked(extractor.extractSignals).mockReturnValue({})

    expect(runDetection()).not.toBeNull()
  })
})
