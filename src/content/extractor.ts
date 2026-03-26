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
  const match = text.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/)?.[1]
  if (match) return parseFloat(match.replace(/,/g, ''))
  return undefined
}

function extractCurrency(): string | undefined {
  const text = document.body?.innerText ?? ''
  const lower = text.toLowerCase()
  const counts: [string, number][] = [
    ['NGN', (text.match(/₦/g)?.length ?? 0) + (lower.match(/\bngn\b/g)?.length ?? 0)],
    ['GBP', (text.match(/£/g)?.length ?? 0) + (lower.match(/\bgbp\b/g)?.length ?? 0)],
    ['EUR', (text.match(/€/g)?.length ?? 0) + (lower.match(/\beur\b/g)?.length ?? 0)],
    ['USD', (text.match(/\$/g)?.length ?? 0) + (lower.match(/\busd\b/g)?.length ?? 0)],
  ]
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a), ['', 0] as [string, number])
  return best[1] > 0 ? best[0] : undefined
}

function extractBillingFrequency(): string | undefined {
  const text = (document.body?.innerText ?? '').toLowerCase()
  const weeklyCount  = (text.match(/\/week|per week|weekly/g) ?? []).length
  const monthlyCount = (text.match(/\/month|per month|monthly/g) ?? []).length
  const yearlyCount  = (text.match(/\/year|per year|annually/g) ?? []).length
  if (weeklyCount === 0 && monthlyCount === 0 && yearlyCount === 0) return undefined
  if (weeklyCount > monthlyCount && weeklyCount > yearlyCount) return 'weekly'
  // Prefer monthly on a tie — most SaaS pricing pages list annual as an upsell
  // alongside the monthly plan the user is actually selecting
  if (yearlyCount > monthlyCount) return 'yearly'
  return 'monthly'
}

function extractTrialDuration(): number | undefined {
  const text = document.body?.innerText ?? ''
  const match =
    text.match(/(\d+)[- ]day(?:s)?\s+free\s+trial/i)?.[1] ??
    text.match(/free\s+(\d+)[- ]day(?:s)?\s+trial/i)?.[1]
  if (match) return parseInt(match, 10)
  return undefined
}
