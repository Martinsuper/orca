import type { NotificationSettings } from './notification-settings-types'

export function getDefaultNotificationSettings(): NotificationSettings {
  return {
    enabled: true,
    agentTaskComplete: true,
    agentNeedsInput: true,
    terminalBell: false,
    todoReminder: true,
    suppressWhenFocused: true,
    customSoundId: 'system',
    customSoundPath: null,
    customSoundVolume: 100,
    mutedNotificationSourceIds: [],
    notifyHiddenWorkspaces: false
  }
}
