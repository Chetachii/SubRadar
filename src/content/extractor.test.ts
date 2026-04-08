import { describe, it, expect, beforeEach } from 'vitest'
import { extractSignals } from './extractor'

beforeEach(() => {
  document.body.innerHTML = ''
  document.title = ''
  // Remove any og:site_name meta
  document.querySelectorAll('meta[property="og:site_name"]').forEach((el) => el.remove())
})

describe('extractSignals', () => {
  describe('serviceName', () => {
    it('extracts from og:site_name meta tag', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:site_name')
      meta.setAttribute('content', 'Netflix')
      document.head.appendChild(meta)

      const result = extractSignals()
      expect(result.serviceName).toBe('Netflix')
    })

    it('falls back to page title', () => {
      document.title = 'Spotify - Music for everyone'
      const result = extractSignals()
      expect(result.serviceName).toBe('Spotify')
    })

    it('splits title on pipe character', () => {
      document.title = 'Hulu | Watch TV Shows'
      const result = extractSignals()
      expect(result.serviceName).toBe('Hulu')
    })

    it('splits title on middle dot', () => {
      document.title = 'Disney+ · Stream movies'
      const result = extractSignals()
      expect(result.serviceName).toBe('Disney+')
    })

    it('returns undefined when no title and no meta', () => {
      const result = extractSignals()
      expect(result.serviceName).toBeUndefined()
    })

    it('prefers og:site_name over title', () => {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:site_name')
      meta.setAttribute('content', 'ActualSite')
      document.head.appendChild(meta)
      document.title = 'PageTitle - something'

      const result = extractSignals()
      expect(result.serviceName).toBe('ActualSite')
    })
  })

  describe('price extraction', () => {
    it('extracts price from dollar amount', () => {
      document.body.innerHTML = '<div>Plan costs $9.99 per month</div>'
      const result = extractSignals()
      expect(result.price).toBe(9.99)
    })

    it('extracts integer price', () => {
      document.body.innerHTML = '<div>Only $15 to start</div>'
      const result = extractSignals()
      expect(result.price).toBe(15)
    })

    it('returns undefined when no price', () => {
      document.body.innerHTML = '<div>No pricing info here</div>'
      const result = extractSignals()
      expect(result.price).toBeUndefined()
    })

    it('extracts first price found', () => {
      document.body.innerHTML = '<div>Basic $5.00 or Premium $15.00</div>'
      const result = extractSignals()
      expect(result.price).toBe(5.0)
    })
  })

  describe('currency detection', () => {
    it('detects USD from dollar sign', () => {
      document.body.innerHTML = '<div>Price: $9.99</div>'
      const result = extractSignals()
      expect(result.currency).toBe('USD')
    })

    it('detects EUR from euro sign', () => {
      document.body.innerHTML = '<div>Price: €9.99</div>'
      const result = extractSignals()
      expect(result.currency).toBe('EUR')
    })

    it('detects GBP from pound sign', () => {
      document.body.innerHTML = '<div>Price: £9.99</div>'
      const result = extractSignals()
      expect(result.currency).toBe('GBP')
    })

    it('detects USD from text "usd"', () => {
      document.body.innerHTML = '<div>Price: 9.99 USD</div>'
      const result = extractSignals()
      expect(result.currency).toBe('USD')
    })

    it('returns undefined when no currency detected', () => {
      document.body.innerHTML = '<div>No price info</div>'
      const result = extractSignals()
      expect(result.currency).toBeUndefined()
    })
  })

  describe('billing frequency', () => {
    it('detects yearly from /year', () => {
      document.body.innerHTML = '<div>$99/year plan</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBe('yearly')
    })

    it('detects yearly from "per year"', () => {
      document.body.innerHTML = '<div>billed per year</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBe('yearly')
    })

    it('returns undefined for "billed annually" alone (billing descriptor, not price period)', () => {
      document.body.innerHTML = '<div>billed annually</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBeUndefined()
    })

    it('detects monthly from /month', () => {
      document.body.innerHTML = '<div>$9.99/month</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBe('monthly')
    })

    it('detects weekly from /week', () => {
      document.body.innerHTML = '<div>$2.99/week</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBe('weekly')
    })

    it('returns undefined when no frequency detected', () => {
      document.body.innerHTML = '<div>No billing info</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBeUndefined()
    })

    it('prefers monthly when both monthly and yearly appear equally (pricing page upsell pattern)', () => {
      document.body.innerHTML = '<div>Choose monthly ($10/month) or yearly ($96/year)</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBe('monthly')
    })

    it('returns yearly only when yearly signals outnumber monthly', () => {
      document.body.innerHTML = '<div>Annual plan: $96/year ($8 per year) — compare with monthly options</div>'
      const result = extractSignals()
      expect(result.billingFrequency).toBe('yearly')
    })
  })

  describe('trial duration', () => {
    it('extracts N-day free trial', () => {
      document.body.innerHTML = '<div>Start your 14-day free trial today</div>'
      const result = extractSignals()
      expect(result.trialDurationDays).toBe(14)
    })

    it('extracts N day free trial (space)', () => {
      document.body.innerHTML = '<div>30 day free trial included</div>'
      const result = extractSignals()
      expect(result.trialDurationDays).toBe(30)
    })

    it('extracts plural days free trial', () => {
      document.body.innerHTML = '<div>7 days free trial</div>'
      const result = extractSignals()
      expect(result.trialDurationDays).toBe(7)
    })

    it('returns undefined when no trial info', () => {
      document.body.innerHTML = '<div>No trial available</div>'
      const result = extractSignals()
      expect(result.trialDurationDays).toBeUndefined()
    })
  })
})
