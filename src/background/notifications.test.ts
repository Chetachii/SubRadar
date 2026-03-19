import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { installChromeMock, resetChromeMock } from '../test/chromeMock'
import { makeSubscription, makePreferences } from '../test/factories'

vi.mock('../repository/subscriptionRepository', () => ({
  listSubscriptions: vi.fn(),
}))

vi.mock('../repository/preferencesRepository', () => ({
  getPreferences: vi.fn(),
}))

vi.mock('../services/subscriptionService', () => ({
  setSnooze: vi.fn(),
  markRenewed: vi.fn(),
}))

vi.mock('../services/reminderService', () => ({
  scanDueReminders: vi.fn(),
}))

import {
  buildNotificationOptions,
  dispatchReminderNotification,
  runScan,
  handleNotificationButtonClick,
  NOTIF_ACTION,
} from './notifications'
import * as subRepo from '../repository/subscriptionRepository'
import * as prefsRepo from '../repository/preferencesRepository'
import * as subService from '../services/subscriptionService'
import * as reminderService from '../services/reminderService'

const TODAY = '2024-06-15'

beforeEach(() => {
  installChromeMock()
  resetChromeMock()
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('buildNotificationOptions', () => {
  it('includes serviceName in title', () => {
    const sub = makeSubscription({ serviceName: 'Netflix' })
    const opts = buildNotificationOptions(sub)
    expect(opts.title).toContain('Netflix')
  })

  it('includes cost in message when present', () => {
    const sub = makeSubscription({ cost: 9.99, currency: 'USD' })
    const opts = buildNotificationOptions(sub)
    expect(opts.message).toContain('9.99')
  })

  it('omits cost from message when not present', () => {
    const sub = makeSubscription({ cost: undefined })
    const opts = buildNotificationOptions(sub)
    expect(opts.message).not.toContain('undefined')
  })

  it('returns 2 action buttons', () => {
    const sub = makeSubscription()
    const opts = buildNotificationOptions(sub)
    expect(opts.buttons).toHaveLength(2)
  })

  it('is of type basic', () => {
    const sub = makeSubscription()
    const opts = buildNotificationOptions(sub)
    expect(opts.type).toBe('basic')
  })
})

describe('dispatchReminderNotification', () => {
  it('calls chrome.notifications.create with sub id', () => {
    const sub = makeSubscription({ id: 'test-123' })
    dispatchReminderNotification(sub)
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      'subradar-test-123',
      expect.any(Object),
    )
  })
})

describe('runScan', () => {
  it('dispatches notifications for eligible subscriptions', async () => {
    const sub = makeSubscription({ id: 'due-sub', reminderDate: TODAY })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([sub])
    vi.mocked(subService.setSnooze).mockResolvedValue(sub)

    await runScan()

    expect(chrome.notifications.create).toHaveBeenCalledWith('subradar-due-sub', expect.any(Object))
    expect(subService.setSnooze).toHaveBeenCalledWith('due-sub', TODAY)
  })

  it('does not dispatch when no subscriptions are due', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([])

    await runScan()

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('sets runtimeMeta after scan', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([])

    await runScan()

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({ runtimeMeta: expect.any(Object) }),
    )
  })

  it('snoozes each eligible subscription after notification', async () => {
    const sub1 = makeSubscription({ id: 'sub-1' })
    const sub2 = makeSubscription({ id: 'sub-2' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub1, sub2])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([sub1, sub2])
    vi.mocked(subService.setSnooze).mockResolvedValue(sub1)

    await runScan()

    expect(subService.setSnooze).toHaveBeenCalledTimes(2)
  })
})

describe('handleNotificationButtonClick', () => {
  it('sets snooze for 1 day on SNOOZE', async () => {
    vi.mocked(subService.setSnooze).mockResolvedValue(makeSubscription())

    await handleNotificationButtonClick('subradar-sub-abc', NOTIF_ACTION.SNOOZE)

    expect(subService.setSnooze).toHaveBeenCalledWith('sub-abc', '2024-06-16')
  })

  it('marks renewed on MARK_RENEWED', async () => {
    vi.mocked(subService.markRenewed).mockResolvedValue(makeSubscription())

    await handleNotificationButtonClick('subradar-sub-abc', NOTIF_ACTION.MARK_RENEWED)

    expect(subService.markRenewed).toHaveBeenCalledWith('sub-abc')
  })

  it('clears notification after action', async () => {
    await handleNotificationButtonClick('subradar-sub-abc', NOTIF_ACTION.SNOOZE)

    expect(chrome.notifications.clear).toHaveBeenCalledWith('subradar-sub-abc')
  })
})
