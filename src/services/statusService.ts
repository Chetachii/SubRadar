import type { Subscription } from '../types/subscription'

export interface GroupedByIntent {
  cancel: Subscription[]
  renew: Subscription[]
  remindBeforeBilling: Subscription[]
}

export function groupByIntent(subscriptions: Subscription[]): GroupedByIntent {
  const groups: GroupedByIntent = { cancel: [], renew: [], remindBeforeBilling: [] }

  for (const sub of subscriptions) {
    if (sub.status === 'archived' || sub.status === 'canceled') continue
    if (sub.intent === 'cancel') groups.cancel.push(sub)
    else if (sub.intent === 'renew') groups.renew.push(sub)
    else groups.remindBeforeBilling.push(sub)
  }

  return groups
}
