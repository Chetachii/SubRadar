import { describe, it, expect, vi, beforeEach } from 'vitest'

const { authMock, insertMock } = vi.hoisted(() => {
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  const fromChain = { insert: insertMock }
  const authMock = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid' } }, error: null }),
  }
  return { authMock, insertMock, fromChain }
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (_table: string) => ({ insert: insertMock }),
    auth: authMock,
  },
}))

import { logEvent } from './analyticsRepository'

beforeEach(() => {
  vi.clearAllMocks()
  authMock.getUser.mockResolvedValue({ data: { user: { id: 'user-uuid' } }, error: null })
  insertMock.mockResolvedValue({ error: null })
})

describe('logEvent', () => {
  it('inserts when user is authenticated', async () => {
    await logEvent('subscription_created', { serviceName: 'Netflix' })
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-uuid',
      event_type: 'subscription_created',
      metadata: { serviceName: 'Netflix' },
    })
  })

  it('skips silently when user is null', async () => {
    authMock.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    await expect(logEvent('subscription_created')).resolves.toBeUndefined()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('does not throw when insert returns an error', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'DB error' } })
    await expect(logEvent('test_event')).resolves.toBeUndefined()
  })

  it('does not throw when getUser throws', async () => {
    authMock.getUser.mockRejectedValueOnce(new Error('Network error'))
    await expect(logEvent('test_event')).resolves.toBeUndefined()
  })

  it('uses empty metadata by default', async () => {
    await logEvent('test_event')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    )
  })
})
