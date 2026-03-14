import type { Subscription, SubscriptionStatus } from '../types/subscription'
import type { Preferences } from '../types/preferences'
import { isDateReached, subtractDays } from '../utils/dates'
import { resolveDueDate } from './reminderService'

const URGENCY_WINDOW_DAYS = 7

function isDueSoon(sub: Subscription): boolean {
  const dueDate = resolveDueDate(sub)
  if (!dueDate) return false
  const urgencyStart = subtractDays(dueDate, URGENCY_WINDOW_DAYS)
  return isDateReached(urgencyStart)
}

export function deriveStatus(sub: Subscription, _prefs: Preferences): SubscriptionStatus {
  if (sub.status === 'archived') return 'archived'
  if (sub.status === 'canceled') return 'canceled'

  if (isDueSoon(sub)) {
    if (sub.intent === 'cancel_before_trial_ends') return 'cancel_soon'
    if (sub.intent === 'remind_before_billing' || sub.intent === 'renew_automatically') {
      return 'renew_soon'
    }
  }

  return 'active'
}

export interface GroupedSubscriptions {
  cancelSoon: Subscription[]
  renewSoon: Subscription[]
  active: Subscription[]
  archived: Subscription[]
}

export function groupBySection(
  subscriptions: Subscription[],
  prefs: Preferences,
): GroupedSubscriptions {
  const groups: GroupedSubscriptions = { cancelSoon: [], renewSoon: [], active: [], archived: [] }

  for (const sub of subscriptions) {
    const status = deriveStatus(sub, prefs)
    switch (status) {
      case 'cancel_soon': groups.cancelSoon.push(sub); break
      case 'renew_soon': groups.renewSoon.push(sub); break
      case 'archived': groups.archived.push(sub); break
      default: groups.active.push(sub)
    }
  }

  return groups
}
