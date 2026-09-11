import type { AppState } from '../types'

type TodosMaps = Pick<
  AppState,
  | 'todosByRepo'
  | 'todosLoadingByRepo'
  | 'todosLoadStatusByRepo'
  | 'todosErrorByRepo'
  | 'todoListsByRepo'
  | 'todoListsLoadingByRepo'
>

export function omitTodosForRepos(
  state: TodosMaps,
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
  const byRepo = omit(state.todosByRepo)
  if (byRepo !== state.todosByRepo) {
    result.todosByRepo = byRepo
  }
  const loading = omit(state.todosLoadingByRepo)
  if (loading !== state.todosLoadingByRepo) {
    result.todosLoadingByRepo = loading
  }
  const status = omit(state.todosLoadStatusByRepo)
  if (status !== state.todosLoadStatusByRepo) {
    result.todosLoadStatusByRepo = status
  }
  const error = omit(state.todosErrorByRepo)
  if (error !== state.todosErrorByRepo) {
    result.todosErrorByRepo = error
  }
  const listsByRepo = omit(state.todoListsByRepo)
  if (listsByRepo !== state.todoListsByRepo) {
    result.todoListsByRepo = listsByRepo
  }
  const listsLoading = omit(state.todoListsLoadingByRepo)
  if (listsLoading !== state.todoListsLoadingByRepo) {
    result.todoListsLoadingByRepo = listsLoading
  }
  return result
}
