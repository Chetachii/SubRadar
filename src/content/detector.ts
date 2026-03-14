import type { DetectionResult } from '../types/subscription'
import { classifyPage, CONFIDENCE_THRESHOLD } from './classifier'
import { extractSignals } from './extractor'

export function runDetection(): DetectionResult | null {
  const { score, matchedSignals } = classifyPage()

  if (score < CONFIDENCE_THRESHOLD) return null

  const signals = extractSignals()

  return {
    pageUrl: window.location.href,
    sourceDomain: window.location.hostname,
    confidenceScore: score,
    matchedSignals,
    ...signals,
  }
}
