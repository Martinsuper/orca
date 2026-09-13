import type { RepoHookSettings } from './orca-yaml-hook-types'
import { DEFAULT_SETUP_AGENT_STARTUP_POLICY } from './setup-agent-startup-policy'

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
