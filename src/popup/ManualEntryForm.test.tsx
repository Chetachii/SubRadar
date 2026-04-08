import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  },
}))
vi.mock('../services/subscriptionService', () => ({
  createSubscription: vi.fn().mockResolvedValue({ id: '1', serviceName: 'Test' }),
}))
vi.mock('../repository/preferencesRepository', () => ({
  getPreferences: vi.fn().mockResolvedValue({}),
}))

vi.stubGlobal('chrome', {
  storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) } },
  runtime: { sendMessage: vi.fn(async () => ({})) },
})

// eslint-disable-next-line import/first
import ManualEntryForm from './ManualEntryForm'

const fetchMock = vi.fn(async () => ({
  ok: true,
  json: async () => [{ name: 'Netflix', domain: 'netflix.com' }],
}))
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

function typeIntoServiceName(value: string) {
  const input = screen.getByPlaceholderText(/spotify/i)
  fireEvent.change(input, { target: { value } })
}

describe('ManualEntryForm — Clearbit debounce', () => {
  it('does not call Clearbit before 500ms', () => {
    render(<ManualEntryForm onSaved={vi.fn()} />)
    typeIntoServiceName('Net')

    act(() => { vi.advanceTimersByTime(499) })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls Clearbit exactly once after 500ms of inactivity', async () => {
    render(<ManualEntryForm onSaved={vi.fn()} />)
    typeIntoServiceName('Netflix')

    await act(async () => { vi.advanceTimersByTime(500) })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('Netflix'),
      expect.any(Object),
    )
  })

  it('debounces rapid typing — only fires once after final keystroke', async () => {
    render(<ManualEntryForm onSaved={vi.fn()} />)

    // Type "Net", wait 400ms (under threshold), then type "flix"
    typeIntoServiceName('Net')
    act(() => { vi.advanceTimersByTime(400) })
    typeIntoServiceName('Netflix')

    await act(async () => { vi.advanceTimersByTime(500) })

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
