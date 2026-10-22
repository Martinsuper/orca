import type { AppState } from '../types'
import { omitProjectLinksForRepos } from './project-links'
import { omitSparsePresetsForRepos } from './sparse-presets'
import { omitTodosForRepos } from './todos-repo-pruning'

/**
 * Drops every repo-scoped row a removed repo owned, so it does not outlive the repo for the whole
 * session. Sparse presets are upstream's map; project links and todos are this fork's.
 */
export function omitRepoScopedRowsForRepos(
  state: AppState,
  removedRepoIds: Iterable<string>
): Partial<AppState> {
  return {
    ...omitSparsePresetsForRepos(state, removedRepoIds),
    ...omitProjectLinksForRepos(state, removedRepoIds),
    ...omitTodosForRepos(state, removedRepoIds)
  }
}
