/**
 * Computed reminder state derived from subscription data at read time.
 * Not stored — recalculated on demand.
 *
 * Evaluation priority: snoozed > overdue > due_today > upcoming
 */
export type ReminderState =
  | 'upcoming'  // renewal is far; reminder window has not opened yet
  | 'due_today' // today is the 3-day-before-renewal trigger
  | 'overdue'   // reminder window is open; renewal is imminent or has passed
  | 'snoozed'   // user snoozed; reminder suppressed until snoozedUntil

/** Computed reminder context for a subscription. Read-only / derived. */
export interface ReminderSummary {
  subscriptionId: string
  state: ReminderState
  dueDate: string       // renewalDate — the billing trigger date
  daysUntilDue: number  // positive = future, 0 = today, negative = past
  isFreeTrial: boolean  // true when subscription.isFreeTrial is set
}
