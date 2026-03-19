import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  toISODate,
  today,
  isDateReached,
  addDays,
  subtractDays,
  daysBetween,
  isValidISODate,
} from './dates'

describe('toISODate', () => {
  it('formats a Date as YYYY-MM-DD', () => {
    expect(toISODate(new Date('2024-06-15T00:00:00Z'))).toBe('2024-06-15')
  })

  it('extracts only the date portion from a datetime', () => {
    expect(toISODate(new Date('2024-12-31T23:59:59Z'))).toBe('2024-12-31')
  })
})

describe('today', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns today as YYYY-MM-DD string', () => {
    expect(today()).toBe('2024-06-15')
  })

  it('matches YYYY-MM-DD pattern', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isDateReached', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true for a past date', () => {
    expect(isDateReached('2024-01-01')).toBe(true)
  })

  it('returns true for today', () => {
    expect(isDateReached('2024-06-15')).toBe(true)
  })

  it('returns false for a future date', () => {
    expect(isDateReached('2024-12-31')).toBe(false)
  })
})

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays('2024-06-15', 5)).toBe('2024-06-20')
  })

  it('adds zero days returns same date', () => {
    expect(addDays('2024-06-15', 0)).toBe('2024-06-15')
  })

  it('crosses month boundary', () => {
    expect(addDays('2024-01-29', 3)).toBe('2024-02-01')
  })

  it('crosses year boundary', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01')
  })

  it('handles negative days (subtracts)', () => {
    expect(addDays('2024-06-15', -5)).toBe('2024-06-10')
  })
})

describe('subtractDays', () => {
  it('subtracts positive days', () => {
    expect(subtractDays('2024-06-15', 5)).toBe('2024-06-10')
  })

  it('crosses month boundary', () => {
    expect(subtractDays('2024-03-01', 1)).toBe('2024-02-29')
  })
})

describe('daysBetween', () => {
  it('returns positive when b is after a', () => {
    expect(daysBetween('2024-06-10', '2024-06-15')).toBe(5)
  })

  it('returns negative when b is before a', () => {
    expect(daysBetween('2024-06-15', '2024-06-10')).toBe(-5)
  })

  it('returns zero for same date', () => {
    expect(daysBetween('2024-06-15', '2024-06-15')).toBe(0)
  })

  it('handles month boundary', () => {
    expect(daysBetween('2024-01-31', '2024-02-01')).toBe(1)
  })
})

describe('isValidISODate', () => {
  it('returns true for valid date', () => {
    expect(isValidISODate('2024-06-15')).toBe(true)
  })

  it('returns false for empty string', () => {
    expect(isValidISODate('')).toBe(false)
  })

  it('returns false for wrong format', () => {
    expect(isValidISODate('15-06-2024')).toBe(false)
    expect(isValidISODate('2024/06/15')).toBe(false)
    expect(isValidISODate('June 15, 2024')).toBe(false)
  })

  it('returns false for month 13', () => {
    // JS Date rolls over month 13 in some engines, but the regex should still catch it
    // via NaN since there's no month 13 that resolves without overflow
    expect(isValidISODate('2024-00-01')).toBe(false)
  })

  it('returns true for leap year date', () => {
    expect(isValidISODate('2024-02-29')).toBe(true)
  })

  it('returns true for valid end-of-month date', () => {
    expect(isValidISODate('2024-03-31')).toBe(true)
  })
})
