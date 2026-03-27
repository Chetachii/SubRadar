import { describe, it, expect, vi, beforeEach } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { makeSubscription, makePreferences } from '../test/factories'

vi.mock('../repository/preferencesRepository', () => ({
  getPreferences: vi.fn(),
}))

vi.mock('../services/subscriptionService', () => ({
  createSubscription: vi.fn(),
  updateSubscription: vi.fn(),
  deleteSubscription: vi.fn(),
  setSnooze: vi.fn(),
  markRenewed: vi.fn(),
  dismissReminder: vi.fn(),
}))

vi.mock('./notifications', () => ({
  runScan: vi.fn(),
  updateBadge: vi.fn(),
  dispatchIfEligible: vi.fn(),
}))

vi.mock('../repository/analyticsRepository', () => ({
  logEvent: vi.fn(),
}))

import { registerMessageRouter } from './messageRouter'
import * as prefsRepo from '../repository/preferencesRepository'
import * as subService from '../services/subscriptionService'
import * as notifications from './notifications'
import * as analyticsRepo from '../repository/analyticsRepository'

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
  it('calls createSubscription, dispatchIfEligible, and runScan', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.createSubscription).mockResolvedValue(sub)
    vi.mocked(notifications.dispatchIfEligible).mockReturnValue(false)

    const response = (await dispatch('SAVE_SUBSCRIPTION', {
      serviceName: 'Netflix',
      intent: 'cancel',
      detectionSource: 'manual_entry',
    })) as { ok: boolean; subscription: unknown }

    expect(subService.createSubscription).toHaveBeenCalled()
    expect(notifications.dispatchIfEligible).toHaveBeenCalledWith(sub, expect.any(Object))
    expect(notifications.runScan).toHaveBeenCalled()
    expect(response.ok).toBe(true)
    expect(response.subscription).toEqual(sub)
  })

  it('passes skipIds to runScan when dispatchIfEligible returns true', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.createSubscription).mockResolvedValue(sub)
    vi.mocked(notifications.dispatchIfEligible).mockReturnValue(true)

    await dispatch('SAVE_SUBSCRIPTION', { serviceName: 'Netflix', intent: 'cancel', detectionSource: 'manual_entry' })

    expect(notifications.runScan).toHaveBeenCalledWith(
      expect.objectContaining({ skipIds: new Set([sub.id]) }),
    )
  })
})

describe('UPDATE_SUBSCRIPTION', () => {
  it('calls updateSubscription, dispatchIfEligible, and runScan', async () => {
    const sub = makeSubscription({ cost: 15 })
    vi.mocked(subService.updateSubscription).mockResolvedValue(sub)
    vi.mocked(notifications.dispatchIfEligible).mockReturnValue(false)

    const response = (await dispatch('UPDATE_SUBSCRIPTION', {
      id: sub.id,
      patch: { cost: 15 },
    })) as { ok: boolean; subscription: unknown }

    expect(subService.updateSubscription).toHaveBeenCalledWith(sub.id, { cost: 15 }, expect.any(Object))
    expect(notifications.dispatchIfEligible).toHaveBeenCalledWith(sub, expect.any(Object))
    expect(notifications.runScan).toHaveBeenCalled()
    expect(response.ok).toBe(true)
    expect(response.subscription).toEqual(sub)
  })
})

describe('DELETE_SUBSCRIPTION', () => {
  it('calls deleteSubscription and returns ok', async () => {
    vi.mocked(subService.deleteSubscription).mockResolvedValue(undefined)

    const response = await dispatch('DELETE_SUBSCRIPTION', { id: 'sub-123' })

    expect(subService.deleteSubscription).toHaveBeenCalledWith('sub-123')
    expect(response).toEqual({ ok: true })
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

  it('calls updateBadge after snooze', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.setSnooze).mockResolvedValue(sub)
    vi.mocked(notifications.updateBadge).mockResolvedValue(undefined)

    await dispatch('SNOOZE_SUBSCRIPTION', { id: sub.id, until: '2024-06-20' })

    expect(notifications.updateBadge).toHaveBeenCalled()
  })
})

describe('DISMISS_REMINDER', () => {
  it('calls dismissReminder and returns the subscription', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.dismissReminder).mockResolvedValue(sub)

    const response = (await dispatch('DISMISS_REMINDER', { id: sub.id })) as {
      ok: boolean
      subscription: unknown
    }

    expect(subService.dismissReminder).toHaveBeenCalledWith(sub.id)
    expect(response.ok).toBe(true)
    expect(response.subscription).toEqual(sub)
  })

  it('calls updateBadge after dismiss', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.dismissReminder).mockResolvedValue(sub)
    vi.mocked(notifications.updateBadge).mockResolvedValue(undefined)

    await dispatch('DISMISS_REMINDER', { id: sub.id })

    expect(notifications.updateBadge).toHaveBeenCalled()
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

describe('analytics logEvent calls', () => {
  it('logs detection_triggered on DETECTION_FOUND', async () => {
    const detection = { pageUrl: 'https://ex.com', sourceDomain: 'ex.com', confidenceScore: 5, matchedSignals: [] }
    await dispatch('DETECTION_FOUND', detection)
    expect(analyticsRepo.logEvent).toHaveBeenCalledWith('detection_triggered', { sourceDomain: 'ex.com' })
  })

  it('logs subscription_created on SAVE_SUBSCRIPTION', async () => {
    const sub = makeSubscription({ serviceName: 'Netflix' })
    vi.mocked(subService.createSubscription).mockResolvedValue(sub)
    vi.mocked(notifications.dispatchIfEligible).mockReturnValue(false)
    await dispatch('SAVE_SUBSCRIPTION', { serviceName: 'Netflix', intent: 'cancel', detectionSource: 'manual_entry' })
    expect(analyticsRepo.logEvent).toHaveBeenCalledWith('subscription_created', { serviceName: 'Netflix' })
  })

  it('logs subscription_updated on UPDATE_SUBSCRIPTION', async () => {
    const sub = makeSubscription({ id: 'sub-99' })
    vi.mocked(subService.updateSubscription).mockResolvedValue(sub)
    vi.mocked(notifications.dispatchIfEligible).mockReturnValue(false)
    await dispatch('UPDATE_SUBSCRIPTION', { id: 'sub-99', patch: { cost: 10 } })
    expect(analyticsRepo.logEvent).toHaveBeenCalledWith('subscription_updated', { id: 'sub-99' })
  })

  it('logs subscription_deleted on DELETE_SUBSCRIPTION', async () => {
    vi.mocked(subService.deleteSubscription).mockResolvedValue(undefined)
    await dispatch('DELETE_SUBSCRIPTION', { id: 'sub-99' })
    expect(analyticsRepo.logEvent).toHaveBeenCalledWith('subscription_deleted', { id: 'sub-99' })
  })

  it('logs reminder_snoozed on SNOOZE_SUBSCRIPTION', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.setSnooze).mockResolvedValue(sub)
    vi.mocked(notifications.updateBadge).mockResolvedValue(undefined)
    await dispatch('SNOOZE_SUBSCRIPTION', { id: sub.id, until: '2026-04-01' })
    expect(analyticsRepo.logEvent).toHaveBeenCalledWith('reminder_snoozed', { id: sub.id, until: '2026-04-01' })
  })

  it('logs reminder_dismissed on DISMISS_REMINDER', async () => {
    const sub = makeSubscription()
    vi.mocked(subService.dismissReminder).mockResolvedValue(sub)
    vi.mocked(notifications.updateBadge).mockResolvedValue(undefined)
    await dispatch('DISMISS_REMINDER', { id: sub.id })
    expect(analyticsRepo.logEvent).toHaveBeenCalledWith('reminder_dismissed', { id: sub.id })
  })
})
