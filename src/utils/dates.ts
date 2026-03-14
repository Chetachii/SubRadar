/** Returns ISO date string (YYYY-MM-DD) from a Date object */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
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

/** Returns true if the ISO date string is a valid calendar date */
export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00')
  return !isNaN(date.getTime())
}
