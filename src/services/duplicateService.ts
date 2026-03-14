import type { Subscription } from '../types/subscription'

export function findDuplicate(
  subscriptions: Subscription[],
  serviceName: string,
  sourceDomain?: string,
): Subscription | null {
  const normalizedName = serviceName.trim().toLowerCase()

  return (
    subscriptions.find((sub) => {
      if (sub.status === 'archived' || sub.status === 'canceled') return false
      const nameMatch = sub.serviceName.trim().toLowerCase() === normalizedName
      if (!nameMatch) return false
      if (sourceDomain && sub.sourceDomain) {
        return sub.sourceDomain === sourceDomain
      }
      return nameMatch
    }) ?? null
  )
}
