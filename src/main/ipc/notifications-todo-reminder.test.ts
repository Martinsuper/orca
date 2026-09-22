import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getAllWindowsMock,
  getDispatchHandler,
  notificationCtorMock,
  notificationShowMock,
  readAuthorizationStatusMock,
  resetNotificationDispatchMocks,
  setTrayAttentionMock
} from './notifications-test-harness'

vi.mock('electron', async () =>
  (await import('./notifications-test-harness')).createElectronModuleMock()
)

vi.mock('./notification-authorization-status', async () =>
  (await import('./notifications-test-harness')).createNotificationAuthorizationModuleMock()
)

vi.mock('./ui', async () =>
  (await import('./notifications-test-harness')).createTrustedUIRendererModuleMock()
)

vi.mock('../tray/system-tray', async () =>
  (await import('./notifications-test-harness')).createSystemTrayModuleMock()
)

import { registerNotificationHandlers } from './notifications'

const fullSettings = {
  enabled: true,
  agentTaskComplete: true,
  terminalBell: true,
  todoReminder: true,
  suppressWhenFocused: false,
  customSoundId: 'system' as const,
  customSoundPath: null,
  customSoundVolume: 100
}

describe('todo-reminder notification dispatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-28T16:00:00Z'))
    resetNotificationDispatchMocks()
  })

  it('delivers a todo-reminder notification when todoReminder is enabled', async () => {
    getAllWindowsMock.mockReturnValue([])
    readAuthorizationStatusMock.mockResolvedValue('authorized')
    registerNotificationHandlers({
      getSettings: () => ({ notifications: fullSettings })
    } as never)

    const handler = getDispatchHandler()
    await handler(
      {},
      {
        source: 'todo-reminder',
        notificationId: 'todo-reminder:t1',
        agentLastAssistantMessage: 'Buy groceries'
      }
    )

    expect(notificationCtorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Task reminder',
        body: 'Buy groceries'
      })
    )
    expect(notificationShowMock).toHaveBeenCalled()
  })

  it('returns source-disabled when todoReminder is false', () => {
    registerNotificationHandlers({
      getSettings: () => ({
        notifications: { ...fullSettings, todoReminder: false }
      })
    } as never)

    const handler = getDispatchHandler()
    const result = handler(
      {},
      {
        source: 'todo-reminder',
        notificationId: 'todo-reminder:t1',
        agentLastAssistantMessage: 'Buy groceries'
      }
    ) as { delivered: boolean; reason?: string }

    expect(result.delivered).toBe(false)
    expect(result.reason).toBe('source-disabled')
  })

  it('sets tray attention when window is not visible', () => {
    getAllWindowsMock.mockReturnValue([])
    readAuthorizationStatusMock.mockResolvedValue('authorized')
    registerNotificationHandlers({
      getSettings: () => ({ notifications: fullSettings })
    } as never)

    const handler = getDispatchHandler()
    handler(
      {},
      {
        source: 'todo-reminder',
        notificationId: 'todo-reminder:t1',
        agentLastAssistantMessage: 'Task title'
      }
    )

    expect(setTrayAttentionMock).toHaveBeenCalledWith(true)
  })
})
