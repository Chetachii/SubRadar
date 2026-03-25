/** Returns ISO date string (YYYY-MM-DD) from a Date object using local time */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Returns today's date as ISO string */
export function today(): string {
  return toISODate(new Date())
}

/** Returns true if the given ISO date is today or in the past */
export function isDateReached(isoDate: string): boolean {
  return isoDate <= today()
}

/** Adds `days` to an ISO date string and returns the new ISO date */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

/** Subtracts `days` from an ISO date string and returns the new ISO date */
export function subtractDays(isoDate: string, days: number): string {
  return addDays(isoDate, -days)
}

/** Returns number of calendar days between two ISO dates (b - a) */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  const dateA = new Date(a + 'T00:00:00').getTime()
  const dateB = new Date(b + 'T00:00:00').getTime()
  return Math.round((dateB - dateA) / msPerDay)
}

/**
 * Adds `months` calendar months to an ISO date string.
 * Clamps to the last day of the target month — e.g. Jan 31 + 1 month → Feb 28/29.
 */
export function addMonths(isoDate: string, months: number): string {
  const date = new Date(isoDate + 'T00:00:00')
  const day = date.getDate()
  date.setDate(1) // prevent month overflow during setMonth
  date.setMonth(date.getMonth() + months)
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, daysInMonth))
  return toISODate(date)
}

/** Returns true if the ISO date string is a valid calendar date */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00')
  if (isNaN(date.getTime())) return false
  // Reject dates that silently roll over (e.g. Feb 30 → Mar 1)
  return toISODate(date) === value
}
