// Fork-local types and compatibility re-exports.
// Upstream split the old shared/types.ts into focused modules; fork-only
// features still import from here. New code should import from the focused
// modules directly.

export type ProjectLink = {
  id: string
  repoId: string
  name: string
  url: string
  category: string
  /** Manual sort order within a category (ascending). Missing sorts last, by name. */
  order?: number
  createdAt: number
  updatedAt: number
}

export type TodoStep = {
  id: string
  title: string
  done: boolean
  /** Epoch-ms of last step-level state change. */
  updatedAt: number
}

export type Todo = {
  id: string
  /** Project-level todo = worktree repoId; global todo = '' */
  repoId: string
  title: string
  note: string
  done: boolean
  /** Epoch-ms of completion; set when `done` transitions to true. */
  completedAt?: number
  createdAt: number
  updatedAt: number
  /** Owning list id. Missing on old data — normalized to the default list on load. */
  listId?: string
  important?: boolean
  /** ISO date string `YYYY-MM-DD` or undefined. */
  dueDate?: string
  /** UTC epoch-ms for a single reminder, or undefined. */
  reminderAt?: number
  /** UTC epoch-ms when the reminder was last fired, to prevent duplicates after restart. */
  reminderDeliveredAt?: number
  /** Local date string `YYYY-MM-DD` when the task was added to My Day. */
  myDayDate?: string
  steps?: TodoStep[]
}

export type TodoList = {
  id: string
  /** Project-level list = worktree repoId; global list = '' */
  repoId: string
  title: string
  createdAt: number
  updatedAt: number
}

export type PlantumlRenderArgs = {
  source: string
  jarPath: string
}

/** Render result: exactly one of `svg` (success) or `error` (failure). */
export type PlantumlRenderResult =
  | { svg: string; error?: undefined }
  | { svg?: undefined; error: string }

export type {
  BrowserCertificateFailure,
  BrowserCertificateProceedResult,
  BrowserCookieImportResult,
  BrowserLoadError,
  BrowserSessionProfile,
  BrowserSessionProfileCreateOptions,
  BrowserSessionProfileScope,
  BrowserSessionProfileSource,
  BrowserViewportOverride
} from './browser-workspace-types'
export type { ClassifiedError } from './classified-error'
export type { SearchOptions, SearchResult } from './code-search-types'
export type {
  DirEntry,
  FilesystemPathFlavor,
  FsChangedPayload,
  MarkdownDocument
} from './filesystem-entry-types'
export type { FolderWorkspace } from './folder-workspace-types'
export type {
  GitBranchCompareResult,
  GitCommitCompareResult,
  GitDiffResult
} from './git-diff-compare-types'
export type { GitForkSyncExpectedUpstream, GitForkSyncResult } from './git-fork-sync'
export type {
  GitConflictOperation,
  GitStagingArea,
  GitStatusResult,
  GitUpstreamStatus
} from './git-status-types'
export type { PRCheckDetail, PRCheckRunDetails } from './github/check-types'
export type {
  GitHubCommentResult,
  GitHubPRReviewCommentInput,
  GitHubReactionContent,
  PRComment
} from './github/comment-types'
export type { ProjectGroup } from './github/project-group-sort'
export type {
  GitHubPRRefreshCandidate,
  GitHubPRRefreshEnqueueResult,
  GitHubPRRefreshEvent,
  GitHubPRRefreshReason,
  PRRefreshOutcome
} from './github/pull-request-refresh-types'
export type {
  GitHubAssignableUser,
  GitHubOwnerRepo,
  GitHubPRFile,
  GitHubPRFileContents,
  GitHubViewer,
  IssueInfo,
  PRInfo
} from './github/pull-request-types'
export type { GetRateLimitResult } from './github/rate-limit-types'
export type {
  GitHubWorkItem,
  GitHubWorkItemDetails,
  ListWorkItemsResult
} from './github/work-item-types'
export type {
  GetGitLabRateLimitResult,
  GitLabAssignableUser,
  GitLabAuthDiagnostic,
  GitLabCommentResult,
  GitLabDiscussionResolveResult,
  GitLabIssueInfo,
  GitLabIssueUpdate,
  GitLabJobTraceResult,
  GitLabMRInlineCommentInput,
  GitLabMRReviewersUpdateResult,
  GitLabMRUpdate,
  GitLabProjectRef,
  GitLabRetryJobResult,
  GitLabTodo,
  GitLabViewer,
  GitLabWorkItem,
  GitLabWorkItemDetails,
  ListMergeRequestsResult,
  MRInfo,
  MRListState
} from './gitlab-types'
export type { GhosttyImportPreview, GlobalSettings } from './global-settings-types'
export type {
  GitHubCreateIssueResult,
  GitHubIssueUpdate,
  LinearIssueUpdate
} from './issue-mutation-types'
export type {
  JiraComment,
  JiraConnectionStatus,
  JiraCreateField,
  JiraCreateIssueArgs,
  JiraIssue,
  JiraIssueFilter,
  JiraIssueType,
  JiraIssueUpdate,
  JiraPriority,
  JiraProject,
  JiraProjectStatusOrder,
  JiraSiteSelection,
  JiraTransition,
  JiraUser,
  JiraViewer
} from './jira-types'
export type { LinearComment, LinearIssue } from './linear/issue-types'
export type {
  LinearCustomViewModel,
  LinearCustomViewSummary,
  LinearProjectDetail,
  LinearProjectSummary
} from './linear/project-types'
export type {
  LinearCollectionResult,
  LinearConnectionStatus,
  LinearLabel,
  LinearMember,
  LinearTeam,
  LinearViewer,
  LinearWorkflowState,
  LinearWorkspaceSelection
} from './linear/workspace-types'
export type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from './managed-account-types'
export type {
  NotificationDeliveryProbeResult,
  NotificationDismissResult,
  NotificationDispatchRequest,
  NotificationDispatchResult,
  NotificationPermissionStatusResult,
  NotificationSoundResult
} from './notification-settings-types'
export type { OnboardingState } from './onboarding-state-types'
export type { OrcaHooks } from './orca-yaml-hook-types'
export type { PersistedUIState } from './persisted-ui-state-types'
export type { CustomPet } from './pet-types'
export type { MemorySnapshot, StatsSummary } from './process-stats-types'
export type {
  NestedRepoScanResult,
  ProjectGroupImportMode,
  ProjectGroupImportResult
} from './project-group-types'
export type {
  Project,
  ProjectHostSetup,
  ProjectHostSetupCreateArgs,
  ProjectHostSetupCreateResult,
  ProjectHostSetupDeleteArgs,
  ProjectHostSetupDeleteResult,
  ProjectHostSetupExistingFolderArgs,
  ProjectHostSetupResult,
  ProjectHostSetupUpdateArgs,
  ProjectHostSetupUpdateResult,
  ProjectUpdateArgs
} from './project-types'
export type { BaseRefDefaultResult, BaseRefSearchResult, Repo } from './repo-types'
export type { PathSource, ShellHydrationFailureReason } from './shell-path-hydration-types'
export type { TaskProvider } from './task-providers'
export type { TuiAgent } from './tui-agent'
export type { FloatingTerminalCwdRequest } from './ui-chrome-types'
export type {
  LinuxPackageInstallInstructions,
  ReleaseBuildListResult,
  UpdateCheckOptions,
  UpdateStatus
} from './update-status-types'
export type { WorkspaceSessionPatch, WorkspaceSessionState } from './workspace-session-state-types'
export type {
  WorktreeBaseStatusEvent,
  WorktreeRemoteBranchConflictEvent
} from './worktree/base-ref-drift-types'
export type {
  CreateWorktreeArgs,
  CreateWorktreeResult,
  ForceDeleteWorktreeBranchResult,
  RemoveWorktreeResult,
  SparsePreset
} from './worktree/create-types'
export type {
  WorktreeDefaultTabsLaunch,
  WorktreeSetupLaunch,
  WorktreeStartupLaunch
} from './worktree/launch-types'
export type { WorkspaceLineage, WorktreeLineage } from './worktree/lineage-types'
export type { WorktreeMeta } from './worktree/meta-types'
export type {
  DetectedWorktreeListResult,
  GitPushTarget,
  GitHubPrStartPoint,
  Worktree,
  WorktreeHeadIdentity
} from './worktree/types'
