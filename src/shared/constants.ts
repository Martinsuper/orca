import type { GlobalSettings } from './global-settings-types'
import type { PersistedState } from './persisted-state-types'
import { EMPTY_CODEX_RESET_CREDIT_ATTEMPT_LEDGER } from './codex-reset-credit-attempt-ledger'
import { buildDefaultSettings } from './default-global-settings'
import { DEFAULT_APP_FONT_FAMILY, DEFAULT_TERMINAL_INACTIVE_PANE_OPACITY } from './default-ui-state'
import { getDefaultOnboardingState } from './default-onboarding-state'
import {
  getDefaultNotificationSettings,
  getDefaultVoiceSettings
} from './default-notification-voice-hook-settings'
import { getDefaultUIState } from './default-ui-state'
import { getDefaultWorkspaceSession } from './default-workspace-session'

export { DEFAULT_STATUS_BAR_ITEMS } from './status-bar-defaults'
export {
  COMPACT_WORKTREE_CARD_PROPERTIES,
  DEFAULT_WORKTREE_CARD_PROPERTIES,
  TASK_WORKTREE_CARD_PROPERTIES,
  getWorktreeCardModeProperties,
  getWorktreeCardModeUpdates,
  isDefaultedCompactWorktreeCardProperties,
  normalizeWorktreeCardProperties
} from './worktree/card-properties'
export {
  DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE,
  DEFAULT_APP_FONT_FAMILY,
  DEFAULT_HIDE_SLEEPING_WORKSPACES,
  DEFAULT_SHOW_SLEEPING_WORKSPACES,
  DEFAULT_TERMINAL_INACTIVE_PANE_OPACITY,
  normalizeAgentActivityDisplayMode
} from './default-ui-state'
export { getDefaultOnboardingState } from './default-onboarding-state'
export {
  getDefaultNotificationSettings,
  getDefaultRepoHookSettings,
  getDefaultVoiceSettings
} from './default-notification-voice-hook-settings'
export { getDefaultUIState } from './default-ui-state'
export { getDefaultWorkspaceSession } from './default-workspace-session'

export const SCHEMA_VERSION = 1

export const ONBOARDING_FINAL_STEP = 5
export const ONBOARDING_FLOW_VERSION = 4

export const ORCA_BROWSER_PARTITION = 'persist:orca-browser'
// Why: inert blank-tab URL shared by main/renderer so the attach policy can allow just this one data URL and reject others.
export const ORCA_BROWSER_BLANK_URL = 'data:text/html,'

// Why: Electron's invoke error path preserves only message text, so signal reconnect via this stable token.
export const SSH_TERMINATE_RECONNECT_REQUIRED = 'SSH_TERMINATE_RECONNECT_REQUIRED'

export const BROWSER_FAMILY_LABELS: Record<string, string> = {
  chrome: 'Google Chrome',
  chromium: 'Chromium',
  comet: 'Comet',
  helium: 'Helium',
  arc: 'Arc',
  edge: 'Microsoft Edge',
  brave: 'Brave',
  firefox: 'Firefox',
  safari: 'Safari',
  manual: 'File'
}

// Why: only the initial value shown in Settings; buildFontFamily() adds the real cross-platform fallback chain.
function defaultTerminalFontFamily(): string {
  const platform = typeof process !== 'undefined' ? process.platform : ''
  if (platform === 'win32') {
    return 'Cascadia Mono'
  }
  if (platform === 'linux') {
    return 'DejaVu Sans Mono'
  }
  return 'SF Mono'
}

export const getDefaultPrimarySelectionMiddleClickPaste = (
  platform = typeof process !== 'undefined' ? process.platform : ''
): boolean => platform === 'linux' || platform === 'darwin'

export const getDefaultTerminalRightClickToPaste = (
  platform = typeof process !== 'undefined' ? process.platform : ''
): boolean => platform === 'win32'

/** Why: ProseMirror renders the whole document without virtualization. After the
 *  parser/highlighter work in #17134/#17147/#17158, M-series Electron measurements
 *  on distinct code blocks every ~600 bytes put visible mount / longest task at
 *  300 KB 0.70 / 0.66 s · 450 KB 1.09 / 1.02 s · 600 KB 1.49 / 1.41 s, with
 *  600 KB typing at 38 ms median / 39 ms p95. Bytes remain the only cheap
 *  pre-parse guard; larger files use source mode with an "Open anyway" escape hatch. */
export const RICH_MARKDOWN_MAX_SIZE_BYTES = 600 * 1024

export const DEFAULT_EDITOR_AUTO_SAVE_DELAY_MS = 1000
export const MIN_EDITOR_AUTO_SAVE_DELAY_MS = 250
export const MAX_EDITOR_AUTO_SAVE_DELAY_MS = 10_000

// Why: first-time seed only — doubles on each dismissal without starring; later thresholds live in starNagNextThreshold.
export const STAR_NAG_INITIAL_THRESHOLD = 35

/** Synthetic worktree id for PTYs not tied to any worktree; shared so main and renderer agree on the sentinel. */
export const ORPHAN_WORKTREE_ID = '__orphan__'

// Why: synthetic local workspace; persistence pruning must classify it without the repo catalog.
export const FLOATING_TERMINAL_WORKTREE_ID = 'global-floating-terminal'

export const REPO_COLORS = [
  '#737373', // neutral
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#8b5cf6', // purple
  '#ec4899' // pink
] as const

export const DEFAULT_REPO_BADGE_COLOR = REPO_COLORS[0]

export function getDefaultWorkspaceDir(homeDir: string): string {
  const separator = homeDir.includes('\\') ? '\\' : '/'
  const trimmedHomeDir = homeDir.replace(/[\\/]+$/, '')
  return [trimmedHomeDir, 'orca', 'workspaces'].join(separator)
}

export function getDefaultSettings(homedir: string): GlobalSettings {
  return buildDefaultSettings({
    workspaceDir: getDefaultWorkspaceDir(homedir),
    appFontFamily: DEFAULT_APP_FONT_FAMILY,
    editorAutoSaveDelayMs: DEFAULT_EDITOR_AUTO_SAVE_DELAY_MS,
    primarySelectionMiddleClickPaste: getDefaultPrimarySelectionMiddleClickPaste(),
    primarySelectionDefaultedForLinux:
      typeof process !== 'undefined' && process.platform === 'linux',
    terminalFontFamily: defaultTerminalFontFamily(),
    terminalInactivePaneOpacity: DEFAULT_TERMINAL_INACTIVE_PANE_OPACITY,
    terminalRightClickToPaste: getDefaultTerminalRightClickToPaste(),
    notifications: getDefaultNotificationSettings(),
    voice: getDefaultVoiceSettings()
  })
}

export function getDefaultPersistedState(homedir: string): PersistedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    repos: [],
    projects: [],
    projectHostSetups: [],
    projectGroups: [],
    folderWorkspaces: [],
    sparsePresetsByRepo: {},
    projectLinksByRepo: {},
    projectLinkFoldersByRepo: {},
    todosByRepo: {},
    todoListsByRepo: {},
    globalTodoLists: [],
    retiredWorktreeNamesByRepo: {},
    retiredWorktreeNamesByNamespace: {},
    worktreeMeta: {},
    worktreeLineageById: {},
    workspaceLineageByChildKey: {},
    settings: getDefaultSettings(homedir),
    ui: getDefaultUIState(),
    githubCache: { pr: {}, issue: {} },
    workspaceSession: getDefaultWorkspaceSession(),
    workspaceSessionsByHostId: {},
    sshTargets: [],
    sshTargetGenerationCounter: 0,
    deletedSshConfigAliases: [],
    sshRemotePtyLeases: [],
    sshPtyConsumerRecoveries: [],
    claudeLivePtySessionIds: [],
    migrationUnsupportedPtyEntries: [],
    legacyPaneKeyAliasEntries: [],
    automations: [],
    automationRuns: [],
    onboarding: getDefaultOnboardingState(),
    featureInteractionTelemetryBuckets: {},
    codexResetCreditAttemptLedger: structuredClone(EMPTY_CODEX_RESET_CREDIT_ATTEMPT_LEDGER)
  }
}
