export const CONFIDENCE_THRESHOLD = 7

interface ClassifierResult {
  score: number
  matchedSignals: string[]
}

const URL_PATTERNS = /\/(pricing|checkout|plans|billing|subscribe|trial|upgrade|premium|signup|join)/i

const TRIAL_PHRASES = [
  'start free trial',
  'free trial',
  'try for free',
  'trial period',
  'days free',
  'start for free',
  'start free',
]

const SUBSCRIPTION_CTAS = [
  'subscribe now',
  'subscribe today',
  'get started',
  'start subscription',
  'choose plan',
  'select plan',
  'pick a plan',
  'view plans',
  'see plans',
  'upgrade now',
  'buy now',
  'get premium',
  'go premium',
  'start free',
  'try free',
  'join now',
]

const PRICING_SIGNALS = [
  'per month',
  'per year',
  'billed annually',
  'billed monthly',
  'billed yearly',
  '/month',
  '/year',
  '/mo',
  '/yr',
  '/ month',
  '/ year',
  '/ mo',
  '/ yr',
  'per seat',
  'per editor',
  'per user',
  'seat/month',
  'editor/month',
  'user/month',
]

const CHECKOUT_PROVIDERS = ['stripe.com', 'paddle.com', 'gumroad.com', 'recurly.com']

// Phrases that indicate device financing / installment plans — not subscriptions
const FINANCING_PHRASES = [
  'installment',
  'financing',
  'payment plan',
  '0% apr',
  '0% interest',
  'monthly payment',
  'finance your',
  'apply for financing',
]

export function classifyPage(): ClassifierResult {
  const signals: string[] = []
  let score = 0

  const url = window.location.href

  if (URL_PATTERNS.test(url)) {
    score += 2
    signals.push('url_pattern')
  }

  const bodyText = document.body?.innerText?.toLowerCase() ?? ''
  const pageTitle = document.title?.toLowerCase() ?? ''
  const combined = bodyText + ' ' + pageTitle

  for (const phrase of TRIAL_PHRASES) {
    if (combined.includes(phrase)) {
      score += 3
      signals.push('trial_language')
      break
    }
  }

  for (const signal of PRICING_SIGNALS) {
    if (combined.includes(signal)) {
      score += 2
      signals.push('pricing_block')
      break
    }
  }

  for (const cta of SUBSCRIPTION_CTAS) {
    if (combined.includes(cta)) {
      score += 3
      signals.push('subscription_cta')
      break
    }
  }

  for (const provider of CHECKOUT_PROVIDERS) {
    if (url.includes(provider) || combined.includes(provider)) {
      score += 3
      signals.push('checkout_provider')
      break
    }
  }

  for (const phrase of FINANCING_PHRASES) {
    if (combined.includes(phrase)) {
      score -= 4
      signals.push('financing_negative')
      break
    }
  }

  return { score, matchedSignals: signals }
}
