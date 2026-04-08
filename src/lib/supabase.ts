import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Service workers have no localStorage; use chrome.storage.local instead
const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    chrome.storage.local.get(key)
      .then((r) => (r[key] as string) ?? null)
      .catch(() => null),
  setItem: (key: string, value: string): Promise<void> =>
    chrome.storage.local.set({ [key]: value }).catch(() => {}),
  removeItem: (key: string): Promise<void> =>
    chrome.storage.local.remove(key).catch(() => {}),
}

// detectSessionInUrl must be true in page contexts (dashboard/popup) to handle
// the OAuth redirect fragment; false in service worker (no window)
const isPageContext = typeof window !== 'undefined'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isPageContext,
  },
})
