import { describe, it, expect } from 'vitest'
import { formatCurrency } from './currency'

describe('formatCurrency', () => {
  it('formats USD by default', () => {
    expect(formatCurrency(9.99)).toBe('$9.99')
  })

  it('formats USD explicitly', () => {
    expect(formatCurrency(15, 'USD')).toBe('$15.00')
  })

  it('formats EUR', () => {
    const result = formatCurrency(9.99, 'EUR')
    expect(result).toContain('9.99')
    expect(result).toMatch(/€|EUR/)
  })

  it('formats GBP', () => {
    const result = formatCurrency(9.99, 'GBP')
    expect(result).toContain('9.99')
    expect(result).toMatch(/£|GBP/)
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats large amounts with correct separators', () => {
    const result = formatCurrency(1000)
    expect(result).toContain('1,000')
  })

  it('always shows two decimal places', () => {
    expect(formatCurrency(5)).toBe('$5.00')
  })
})
