import type { RepoHookSettings } from './orca-yaml-hook-types'
import type { VoiceSettings } from './speech-types'
import { DEFAULT_SETUP_AGENT_STARTUP_POLICY } from './setup-agent-startup-policy'

export { getDefaultNotificationSettings } from './notification-settings-defaults'

export function getDefaultVoiceSettings(): VoiceSettings {
  return {
    enabled: false,
    sttModel: '',
    modelsDir: '',
    language: 'en',
    dictationMode: 'toggle' as const,
    terminalConfirmBeforeInsert: false,
    userModels: [],
    openAiApiKeyConfigured: false,
    microphoneDeviceId: null,
    microphoneDeviceLabel: null
  }
}

export function getDefaultRepoHookSettings(): RepoHookSettings {
  return {
    mode: 'auto',
    setupRunPolicy: 'run-by-default',
    setupAgentStartupPolicy: DEFAULT_SETUP_AGENT_STARTUP_POLICY,
    scripts: {
      setup: '',
      archive: ''
    }
  }
}
