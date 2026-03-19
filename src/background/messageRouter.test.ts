import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { makeSubscription, makePreferences } from '../test/factories'

vi.mock('../repository/preferencesRepository', () => ({
  getPreferences: vi.fn(),
}))

vi.mock('../services/subscriptionService', () => ({
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  setSnooze: vi.fn(),
  markRenewed: vi.fn(),
}))

vi.mock('./notifications', () => ({
  runScan: vi.fn(),
}))

import { registerMessageRouter } from './messageRouter'
import * as prefsRepo from '../repository/preferencesRepository'
import * as subService from '../services/subscriptionService'
import * as notifications from './notifications'

type MessageListener = (
  message: { type: string; payload?: unknown },
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void

function getListener(): MessageListener {
  return vi.mocked(chrome.runtime.onMessage.addListener).mock
    .calls[0][0] as MessageListener
}

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
  vi.clearAllMocks()
  vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
  registerMessageRouter()
})

async function dispatch(type: string, payload?: unknown): Promise<unknown> {
  const listener = getListener()
  return new Promise((resolve) => {
    listener({ type, payload }, {}, resolve)
  })
}

describe('DETECTION_FOUND', () => {
  it('stores detection in session storage and returns ok', async () => {
    const detection = { pageUrl: 'https://ex.com', sourceDomain: 'ex.com', confidenceScore: 5, matchedSignals: [] }
    const response = await dispatch('DETECTION_FOUND', detection)
    expect(response).toEqual({ ok: true })
    expect(chrome.storage.session.set).toHaveBeenCalledWith({ pendingDetection: detection })
  })
})

describe('SAVE_SUBSCRIPTION', () => {
  it('calls createSubscription and returns the subscription', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.createSubscription).mockResolvedValue(sub)

    const response = (await dispatch('SAVE_SUBSCRIPTION', {
      serviceName: 'Netflix',
      intent: 'cancel',
      detectionSource: 'manual_entry',
    })) as { ok: boolean; subscription: unknown }

    expect(subService.createSubscription).toHaveBeenCalled()
    expect(response.ok).toBe(true)
    expect(response.subscription).toEqual(sub)
  })
})

describe('UPDATE_SUBSCRIPTION', () => {
  it('calls updateSubscription and returns the subscription', async () => {
    const sub = makeSubscription({ cost: 15 })
    vi.mocked(subService.updateSubscription).mockResolvedValue(sub)

    const response = (await dispatch('UPDATE_SUBSCRIPTION', {
      id: sub.id,
      patch: { cost: 15 },
    })) as { ok: boolean; subscription: unknown }

    expect(subService.updateSubscription).toHaveBeenCalledWith(sub.id, { cost: 15 }, expect.any(Object))
    expect(response.ok).toBe(true)
    expect(response.subscription).toEqual(sub)
  })
})

describe('RUN_REMINDER_SCAN', () => {
  it('calls runScan and returns ok', async () => {
    vi.mocked(notifications.runScan).mockResolvedValue(undefined)
    const response = await dispatch('RUN_REMINDER_SCAN')
    expect(notifications.runScan).toHaveBeenCalled()
    expect(response).toEqual({ ok: true })
  })
})

describe('SNOOZE_SUBSCRIPTION', () => {
  it('calls setSnooze and returns the subscription', async () => {
    const sub = makeSubscription({ snoozedUntil: '2024-06-20' })
    vi.mocked(subService.setSnooze).mockResolvedValue(sub)

    const response = (await dispatch('SNOOZE_SUBSCRIPTION', {
      id: sub.id,
      until: '2024-06-20',
    })) as { ok: boolean; subscription: unknown }

    expect(subService.setSnooze).toHaveBeenCalledWith(sub.id, '2024-06-20')
    expect(response.ok).toBe(true)
  })
})

describe('MARK_RENEWED', () => {
  it('calls markRenewed and returns the subscription', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.markRenewed).mockResolvedValue(sub)

    const response = (await dispatch('MARK_RENEWED', { id: sub.id })) as {
      ok: boolean
      subscription: unknown
    }

    expect(subService.markRenewed).toHaveBeenCalledWith(sub.id)
    expect(response.ok).toBe(true)
  })
})

describe('unknown message type', () => {
  it('returns error for unknown type', async () => {
    const response = (await dispatch('UNKNOWN_TYPE')) as { error: string }
    expect(response.error).toContain('Unknown message type')
  })
})
