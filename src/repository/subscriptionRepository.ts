import type { Subscription } from '../types/subscription'

const STORAGE_KEY = 'subscriptions'

export async function listSubscriptions(): Promise<Subscription[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as Subscription[]) ?? []
}

export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const subs = await listSubscriptions()
  return subs.find((s) => s.id === id) ?? null
}

export async function createSubscription(
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Subscription> {
  const subs = await listSubscriptions()
  const now = new Date().toISOString()
  const sub: Subscription = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
  await chrome.storage.local.set({ [STORAGE_KEY]: [...subs, sub] })
  return sub
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription> {
  const subs = await listSubscriptions()
  const now = new Date().toISOString()
  const updated = subs.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: now } : s))
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
  return updated.find((s) => s.id === id)!
}

export async function deleteSubscription(id: string): Promise<void> {
  const subs = await listSubscriptions()
  await chrome.storage.local.set({ [STORAGE_KEY]: subs.filter((s) => s.id !== id) })
}
