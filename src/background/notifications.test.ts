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
  dismissReminder: vi.fn(),
  stampReminderSent: vi.fn(),
  rollRenewalDate: vi.fn(),
  archiveSubscription: vi.fn(),
}))

vi.mock('../services/reminderService', () => ({
  scanDueReminders: vi.fn(),
  getEligibleReminderPoints: vi.fn(),
}))

import {
  buildNotificationOptions,
  dispatchReminderNotification,
  runScan,
  updateBadge,
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
    const opts = buildNotificationOptions(sub, 'early')
    expect(opts.title).toContain('Netflix')
  })

  it('includes cost in message when present', () => {
    const sub = makeSubscription({ cost: 9.99, currency: 'USD' })
    const opts = buildNotificationOptions(sub, 'early')
    expect(opts.message).toContain('9.99')
  })

  it('omits cost from message when not present', () => {
    const sub = makeSubscription({ cost: undefined })
    const opts = buildNotificationOptions(sub, 'early')
    expect(opts.message).not.toContain('undefined')
  })

  it('returns 2 action buttons labeled Snooze 1 day and Dismiss', () => {
    const sub = makeSubscription()
    const opts = buildNotificationOptions(sub, 'early')
    expect(opts.buttons).toHaveLength(2)
    expect(opts.buttons![0].title).toBe('Snooze 1 day')
    expect(opts.buttons![1].title).toBe('Dismiss')
  })

  it('is of type basic', () => {
    const sub = makeSubscription()
    const opts = buildNotificationOptions(sub, 'early')
    expect(opts.type).toBe('basic')
  })
})

describe('dispatchReminderNotification', () => {
  it('calls chrome.notifications.create with sub id and point suffix', () => {
    const sub = makeSubscription({ id: 'test-123' })
    dispatchReminderNotification(sub, 'early')
    expect(chrome.notifications.create).toHaveBeenCalledWith(
      'subradar-test-123-early',
      expect.any(Object),
      expect.any(Function),
    )
  })
})

describe('runScan', () => {
  it('dispatches early notification and stamps reminder sent', async () => {
    const sub = makeSubscription({ id: 'due-sub', renewalDate: '2024-06-18', reminderDate: TODAY })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([sub])
    vi.mocked(reminderService.getEligibleReminderPoints).mockReturnValue(['early'])
    vi.mocked(subService.stampReminderSent).mockResolvedValue(sub)

    await runScan()

    expect(chrome.notifications.create).toHaveBeenCalledWith('subradar-due-sub-early', expect.any(Object), expect.any(Function))
    expect(subService.stampReminderSent).toHaveBeenCalledWith('due-sub')
    expect(subService.rollRenewalDate).not.toHaveBeenCalled()
  })

  it('dispatches renewal_day notification and calls rollRenewalDate', async () => {
    const sub = makeSubscription({ id: 'renew-sub', renewalDate: TODAY })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([sub])
    vi.mocked(reminderService.getEligibleReminderPoints).mockReturnValue(['renewal_day'])
    vi.mocked(subService.rollRenewalDate).mockResolvedValue(sub)

    await runScan()

    expect(chrome.notifications.create).toHaveBeenCalledWith('subradar-renew-sub-renewal', expect.any(Object), expect.any(Function))
    expect(subService.rollRenewalDate).toHaveBeenCalledWith('renew-sub', expect.any(Object))
    expect(subService.stampReminderSent).not.toHaveBeenCalled()
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

  it('stamps reminder sent for each eligible subscription after notification', async () => {
    const sub1 = makeSubscription({ id: 'sub-1' })
    const sub2 = makeSubscription({ id: 'sub-2' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub1, sub2])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([sub1, sub2])
    vi.mocked(reminderService.getEligibleReminderPoints).mockReturnValue(['early'])
    vi.mocked(subService.stampReminderSent).mockResolvedValue(sub1)

    await runScan()

    expect(subService.stampReminderSent).toHaveBeenCalledTimes(2)
  })
})

describe('handleNotificationButtonClick', () => {
  it('sets snooze for 1 day on SNOOZE', async () => {
    vi.mocked(subService.setSnooze).mockResolvedValue(makeSubscription())

    await handleNotificationButtonClick('subradar-sub-abc-early', NOTIF_ACTION.SNOOZE)

    expect(subService.setSnooze).toHaveBeenCalledWith('sub-abc', '2024-06-16')
  })

  it('calls dismissReminder on DISMISS', async () => {
    vi.mocked(subService.dismissReminder).mockResolvedValue(makeSubscription())

    await handleNotificationButtonClick('subradar-sub-abc-early', NOTIF_ACTION.DISMISS)

    expect(subService.dismissReminder).toHaveBeenCalledWith('sub-abc')
  })

  it('clears notification after action', async () => {
    await handleNotificationButtonClick('subradar-sub-abc-early', NOTIF_ACTION.SNOOZE)

    expect(chrome.notifications.clear).toHaveBeenCalledWith('subradar-sub-abc-early')
  })
})

// TODAY = '2024-06-15' (set by fake timers in beforeEach)
describe('updateBadge', () => {
  it('sets badge to empty string when no subs are due within 3 days', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
  })

  it('sets badge to count when renewalDate is today', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([
      makeSubscription({ renewalDate: TODAY }),
    ])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1' })
  })

  it('sets badge to count when renewalDate is exactly 3 days out', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([
      makeSubscription({ renewalDate: '2024-06-18' }), // TODAY + 3
    ])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '1' })
  })

  it('excludes renewalDate 4 days out', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([
      makeSubscription({ renewalDate: '2024-06-19' }), // TODAY + 4
    ])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
  })

  it('excludes archived subs', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([
      makeSubscription({ renewalDate: TODAY, status: 'archived' }),
    ])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
  })

  it('excludes canceled subs', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([
      makeSubscription({ renewalDate: TODAY, status: 'canceled' }),
    ])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' })
  })

  it('counts multiple qualifying subs', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([
      makeSubscription({ renewalDate: TODAY }),
      makeSubscription({ renewalDate: '2024-06-17' }),
      makeSubscription({ renewalDate: '2024-06-19' }), // outside window
    ])

    await updateBadge()

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '2' })
  })

  it('always sets badge background color to #E74C3C', async () => {
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([])

    await updateBadge()

    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#E74C3C' })
  })
})

describe('runScan — auto-archive overdue subs', () => {
  // System time is set to 2024-06-15 in beforeEach

  it('archives active sub overdue by 8 days and skips notification', async () => {
    const sub = makeSubscription({ id: 'overdue-8', renewalDate: '2024-06-07' }) // 8 days before 2024-06-15
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(subService.archiveSubscription).mockResolvedValue(sub)
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([])

    await runScan()

    expect(subService.archiveSubscription).toHaveBeenCalledWith('overdue-8')
    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('archives sub overdue by exactly 7 days (boundary)', async () => {
    const sub = makeSubscription({ id: 'overdue-7', renewalDate: '2024-06-08' }) // exactly 7 days before 2024-06-15
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(subService.archiveSubscription).mockResolvedValue(sub)
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([])

    await runScan()

    expect(subService.archiveSubscription).toHaveBeenCalledWith('overdue-7')
  })

  it('does not archive sub overdue by only 6 days', async () => {
    const sub = makeSubscription({ id: 'overdue-6', renewalDate: '2024-06-09' }) // 6 days before TODAY
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([])

    await runScan()

    expect(subService.archiveSubscription).not.toHaveBeenCalled()
  })

  it('does not archive already-archived sub', async () => {
    const sub = makeSubscription({ id: 'already-archived', renewalDate: '2024-06-01', status: 'archived' })
    vi.mocked(subRepo.listSubscriptions).mockResolvedValue([sub])
    vi.mocked(prefsRepo.getPreferences).mockResolvedValue(makePreferences())
    vi.mocked(reminderService.scanDueReminders).mockReturnValue([])

    await runScan()

    expect(subService.archiveSubscription).not.toHaveBeenCalled()
  })
})
