import type { AppState } from '../types'

type ProjectLinksMaps = Pick<
  AppState,
  | 'projectLinksByRepo'
  | 'projectLinksLoadingByRepo'
  | 'projectLinksLoadStatusByRepo'
  | 'projectLinksErrorByRepo'
  | 'projectLinkFoldersByRepo'
>

export function omitProjectLinksForRepos(
  state: ProjectLinksMaps,
  removedRepoIds: Iterable<string>
): Partial<AppState> {
  const removed = removedRepoIds instanceof Set ? removedRepoIds : new Set(removedRepoIds)
  if (removed.size === 0) {
    return {}
  }
  const omit = <T>(obj: Record<string, T>): Record<string, T> => {
    let changed = false
    const result = { ...obj }
    for (const id of removed) {
      if (id in result) {
        delete result[id]
        changed = true
      }
    }
    return changed ? result : obj
  }
  const result: Partial<AppState> = {}
  const byRepo = omit(state.projectLinksByRepo)
  if (byRepo !== state.projectLinksByRepo) {
    result.projectLinksByRepo = byRepo
  }
  const loading = omit(state.projectLinksLoadingByRepo)
  if (loading !== state.projectLinksLoadingByRepo) {
    result.projectLinksLoadingByRepo = loading
  }
  const status = omit(state.projectLinksLoadStatusByRepo)
  if (status !== state.projectLinksLoadStatusByRepo) {
    result.projectLinksLoadStatusByRepo = status
  }
  const error = omit(state.projectLinksErrorByRepo)
  if (error !== state.projectLinksErrorByRepo) {
    result.projectLinksErrorByRepo = error
  }
  const folders = omit(state.projectLinkFoldersByRepo)
  if (folders !== state.projectLinkFoldersByRepo) {
    result.projectLinkFoldersByRepo = folders
  }
  return result
}
