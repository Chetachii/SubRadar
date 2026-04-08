import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getCachedFavicon } from './faviconCache'

// --- chrome.storage.local mock ---
const store: Record<string, unknown> = {}

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (obj: Record<string, unknown>) => { Object.assign(store, obj) }),
    },
  },
})

// --- FileReader mock ---
class MockFileReader {
  onload: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  result: string | null = null

  readAsDataURL(_blob: Blob) {
    this.result = 'data:image/png;base64,FAKEDATA'
    this.onload?.({})
  }
}
vi.stubGlobal('FileReader', MockFileReader)

// --- fetch mock ---
function makeFetchMock(ok: boolean) {
  return vi.fn(async () => ({
    ok,
    blob: async () => new Blob(['fakeimage'], { type: 'image/png' }),
  }))
}

beforeEach(() => {
  // Clear storage between tests
  for (const k of Object.keys(store)) delete store[k]
  vi.restoreAllMocks()
})

describe('getCachedFavicon', () => {
  it('fetches and caches favicon on first call', async () => {
    const fetchMock = makeFetchMock(true)
    vi.stubGlobal('fetch', fetchMock)

    const result = await getCachedFavicon('example.com')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('example.com'),
    )
    expect(result).toBe('data:image/png;base64,FAKEDATA')
    expect(store['favicon:example.com']).toBe('data:image/png;base64,FAKEDATA')
  })

  it('returns cached value without fetching on second call', async () => {
    store['favicon:example.com'] = 'data:image/png;base64,CACHED'
    const fetchMock = makeFetchMock(true)
    vi.stubGlobal('fetch', fetchMock)

    const result = await getCachedFavicon('example.com')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result).toBe('data:image/png;base64,CACHED')
  })

  it('returns null when fetch responds with non-ok status', async () => {
    vi.stubGlobal('fetch', makeFetchMock(false))

    const result = await getCachedFavicon('broken.com')

    expect(result).toBeNull()
    expect(store['favicon:broken.com']).toBeUndefined()
  })

  it('returns null and does not cache when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network error') }))

    const result = await getCachedFavicon('offline.com')

    expect(result).toBeNull()
    expect(store['favicon:offline.com']).toBeUndefined()
  })

  it('caches different domains independently', async () => {
    store['favicon:a.com'] = 'data:image/png;base64,A'
    store['favicon:b.com'] = 'data:image/png;base64,B'
    vi.stubGlobal('fetch', makeFetchMock(true))

    const [a, b] = await Promise.all([
      getCachedFavicon('a.com'),
      getCachedFavicon('b.com'),
    ])

    expect(a).toBe('data:image/png;base64,A')
    expect(b).toBe('data:image/png;base64,B')
    // Both served from cache — no fetch needed
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })
})
