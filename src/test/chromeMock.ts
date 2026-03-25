import { vi } from 'vitest'

export const localStore = new Map<string, unknown>()
export const sessionStore = new Map<string, unknown>()
export const alarmStore = new Map<string, chrome.alarms.Alarm>()

function makeStorage(store: Map<string, unknown>) {
  return {
    get: vi.fn(async (key: string | string[]) => {
      if (typeof key === 'string') {
        return { [key]: store.get(key) }
      }
      const result: Record<string, unknown> = {}
      for (const k of key) result[k] = store.get(k)
      return result
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, v)
    }),
    remove: vi.fn(async (key: string) => {
      store.delete(key)
    }),
  }
}

export function installChromeMock() {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    storage: {
      local: makeStorage(localStore),
      session: makeStorage(sessionStore),
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn() },
      getURL: vi.fn((path: string) => `chrome-extension://fake-id/${path}`),
    },
    notifications: {
      create: vi.fn(),
      clear: vi.fn(),
      onButtonClicked: { addListener: vi.fn() },
    },
    alarms: {
      create: vi.fn((name: string, info: chrome.alarms.AlarmCreateInfo) => {
        alarmStore.set(name, {
          name,
          scheduledTime: Date.now(),
          periodInMinutes: info.periodInMinutes,
        })
      }),
      get: vi.fn(
        (name: string, callback: (alarm: chrome.alarms.Alarm | undefined) => void) => {
          callback(alarmStore.get(name))
        },
      ),
      onAlarm: { addListener: vi.fn() },
    },
    tabs: {
      create: vi.fn(),
    },
    action: {
      setBadgeText: vi.fn(),
      setBadgeBackgroundColor: vi.fn(),
    },
  }
}

export function resetChromeMock() {
  localStore.clear()
  sessionStore.clear()
  alarmStore.clear()
}
