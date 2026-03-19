import type { DetectionResult } from '../types/subscription'

type PartialDetection = Partial<Omit<DetectionResult, 'pageUrl' | 'sourceDomain' | 'confidenceScore' | 'matchedSignals'>>

export function extractSignals(): PartialDetection {
  const result: PartialDetection = {}

  result.serviceName = extractServiceName()
  result.price = extractPrice()
  result.currency = extractCurrency()
  result.billingFrequency = extractBillingFrequency()
  result.trialDurationDays = extractTrialDuration()

  return result
}

function extractServiceName(): string | undefined {
  const ogSiteName = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content
  if (ogSiteName) return ogSiteName.trim()

  const title = document.title
  if (title) return title.split(/[-|·]/)[0].trim()

  return undefined
}

function extractPrice(): number | undefined {
  const text = document.body?.innerText ?? ''
  const match = text.match(/\$\s*(\d+(?:\.\d{2})?)/)?.[1]
  if (match) return parseFloat(match)
  return undefined
}

function extractCurrency(): string | undefined {
  const text = document.body?.innerText ?? ''
  if (text.includes('₦') || text.toLowerCase().includes('ngn')) return 'NGN'
  if (text.includes('£') || text.toLowerCase().includes('gbp')) return 'GBP'
  if (text.includes('€') || text.toLowerCase().includes('eur')) return 'EUR'
  if (text.includes('$') || text.toLowerCase().includes('usd')) return 'USD'
  return undefined
}

function extractBillingFrequency(): string | undefined {
  const text = (document.body?.innerText ?? '').toLowerCase()
  if (text.includes('/year') || text.includes('per year') || text.includes('annually')) return 'yearly'
  if (text.includes('/month') || text.includes('per month') || text.includes('monthly')) return 'monthly'
  if (text.includes('/week') || text.includes('per week') || text.includes('weekly')) return 'weekly'
  return undefined
}

function extractTrialDuration(): number | undefined {
  const text = document.body?.innerText ?? ''
  const match = text.match(/(\d+)[- ]day(?:s)?\s+free\s+trial/i)?.[1]
  if (match) return parseInt(match, 10)
  return undefined
}
