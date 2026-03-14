import type { Subscription } from '../types/subscription'
import { generateId } from '../utils/ids'

const STORAGE_KEY = 'subscriptions'

async function readAll(): Promise<Subscription[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as Subscription[]) ?? []
}

async function writeAll(subscriptions: Subscription[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: subscriptions })
}

export async function listSubscriptions(): Promise<Subscription[]> {
  return readAll()
}

export async function getSubscriptionById(id: string): Promise<Subscription | null> {
  const all = await readAll()
  return all.find((s) => s.id === id) ?? null
}

export async function createSubscription(
  data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Subscription> {
  const now = new Date().toISOString()
  const subscription: Subscription = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  }
  const all = await readAll()
  await writeAll([...all, subscription])
  return subscription
}

export async function updateSubscription(
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription> {
  const all = await readAll()
  const index = all.findIndex((s) => s.id === id)
  if (index === -1) throw new Error(`Subscription not found: ${id}`)
  const updated: Subscription = {
    ...all[index],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  }
  all[index] = updated
  await writeAll(all)
  return updated
}

export async function deleteSubscription(id: string): Promise<void> {
  const all = await readAll()
  await writeAll(all.filter((s) => s.id !== id))
}
