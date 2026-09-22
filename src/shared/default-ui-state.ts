import type { PersistedUIState } from './persisted-ui-state-types'
import { DEFAULT_STATUS_BAR_ITEMS } from './status-bar-defaults'
import type { AgentActivityDisplayMode } from './ui-chrome-types'
import { cloneDefaultWorkspaceStatuses } from './workspace-statuses'
import { DEFAULT_WORKTREE_CARD_PROPERTIES } from './worktree/card-properties'
import { DEFAULT_AGENTS_GROUP_BY, DEFAULT_AGENTS_READ_FILTER } from './agents-view-thread-filters'
import { DEFAULT_USAGE_PERCENTAGE_DISPLAY } from './usage-percentage-display'
import { DEFAULT_STATUS_BAR_USAGE_MODE } from './status-bar-usage-mode'
import { DEFAULT_BROWSER_PAGE_ZOOM_LEVEL } from './browser-page-zoom'

export const DEFAULT_APP_FONT_FAMILY = 'Geist'
export const DEFAULT_SHOW_SLEEPING_WORKSPACES = true
export const DEFAULT_HIDE_SLEEPING_WORKSPACES = false
export const DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE: AgentActivityDisplayMode = 'compact'
export const DEFAULT_TERMINAL_INACTIVE_PANE_OPACITY = 0.9

export function normalizeAgentActivityDisplayMode(value: unknown): AgentActivityDisplayMode {
  return value === 'full' || value === 'compact' ? value : DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE
}

export function getDefaultUIState(): PersistedUIState {
  return {
    lastActiveRepoId: null,
    lastActiveWorktreeId: null,
    activeView: 'terminal',
    sidebarWidth: 280,
    rightSidebarOpen: true,
    rightSidebarTab: 'explorer',
    rightSidebarExplorerView: 'files',
    rightSidebarWidth: 350,
    markdownTocPanelWidth: 240,
    combinedDiffFileTreeWidth: 256,
    groupBy: 'repo',
    sortBy: 'recent',
    projectOrderBy: 'manual',
    showActiveOnly: false,
    hideSleepingWorkspaces: DEFAULT_HIDE_SLEEPING_WORKSPACES,
    workspaceHostScope: 'all',
    visibleWorkspaceHostIds: null,
    workspaceHostOrder: [],
    automationHostFilter: { kind: 'all' },
    manualRepoOrder: [],
    showSleepingWorkspaces: DEFAULT_SHOW_SLEEPING_WORKSPACES,
    hideDefaultBranchWorkspace: false,
    hideAutomationGeneratedWorkspaces: false,
    hideCliCreatedWorkspaces: false,
    hideDetachedHeadWorkspaces: false,
    hideWorkspacesFromOtherDevices: false,
    alwaysShowDefaultBranchWorkspace: true,
    showDotfilesByWorktree: {},
    filterRepoIds: [],
    agentsVisibleHostIds: null,
    agentsFilterRepoIds: [],
    agentsShowChildAgents: false,
    agentsCompactMode: true,
    agentsShowSearch: true,
    agentsReadFilter: DEFAULT_AGENTS_READ_FILTER,
    agentsGroupBy: DEFAULT_AGENTS_GROUP_BY,
    collapsedGroups: [],
    uiZoomLevel: 0,
    editorFontZoomLevel: 0,
    worktreeCardProperties: [...DEFAULT_WORKTREE_CARD_PROPERTIES],
    _worktreeCardModeDefaulted: true,
    agentActivityDisplayMode: DEFAULT_AGENT_ACTIVITY_DISPLAY_MODE,
    workspaceStatuses: cloneDefaultWorkspaceStatuses(),
    workspaceBoardOpacity: 1,
    workspaceBoardColumnWidth: 308,
    syncTaskStatusFromWorkspaceBoard: false,
    _workspaceStatusesDefaultOrderMigrated: true,
    _workspaceStatusesReorderedDefaultRepaired: true,
    _workspaceStatusesDefaultWorkflowMigrated: true,
    _workspaceStatusesDefaultVisualsMigrated: true,
    statusBarItems: [...DEFAULT_STATUS_BAR_ITEMS],
    statusBarVisible: true,
    usagePercentageDisplay: DEFAULT_USAGE_PERCENTAGE_DISPLAY,
    statusBarUsageMode: DEFAULT_STATUS_BAR_USAGE_MODE,
    dismissedUpdateVersion: null,
    lastUpdateCheckAt: null,
    trustedOrcaHooks: {},
    setupScriptPromptDismissedRepoIds: [],
    acknowledgedAgentsByPaneKey: {},
    activityClearedAtByPaneKey: {},
    manuallyUnreadTurnsByPaneKey: {},
    setupGuideSidebarDismissed: false,
    setupGuideBrowserMilestoneMigrated: true,
    setupGuideBrowserMilestoneLegacyComplete: false,
    browserImportHintHidden: false,
    trayMinimizeNoticeShown: false,
    osc52ClipboardDefaultOnNoticePending: false,
    mobileEmulatorTabIntroDismissed: false,
    mobileEmulatorAgentSetupDismissed: false,
    projectOrderManualDefaultNoticeDismissed: true,
    usagePercentageDisplayChangeNoticeDismissed: true,
    workspaceCleanup: { dismissals: {} },
    featureTipsSeenIds: [],
    featureInteractions: {},
    contextualToursSeenIds: [],
    browserDefaultZoomLevel: DEFAULT_BROWSER_PAGE_ZOOM_LEVEL
  }
}
