import { useEffect } from 'react'
import { useAppStore } from '../store'

type TodoInvalidationApi = {
  onChanged: (callback: (data: { repoId: string }) => void) => () => void
  onListsChanged: (callback: (data: { repoId: string }) => void) => () => void
  onGlobalChanged: (callback: () => void) => () => void
  onGlobalListsChanged: (callback: () => void) => () => void
}

type TodoInvalidationStore = {
  invalidateTodos: (repoId: string) => void
  invalidateTodoLists: (repoId: string) => void
  invalidateGlobalTodos: () => void
  invalidateGlobalTodoLists: () => void
}

export function createTodoInvalidationSubscriptions(
  api: TodoInvalidationApi,
  store: TodoInvalidationStore
): () => void {
  const unsubscribers = [
    api.onChanged(({ repoId }) => store.invalidateTodos(repoId)),
    api.onListsChanged(({ repoId }) => store.invalidateTodoLists(repoId)),
    api.onGlobalChanged(() => store.invalidateGlobalTodos()),
    api.onGlobalListsChanged(() => store.invalidateGlobalTodoLists())
  ]
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
  }
}

export function useTodoInvalidationSubscriptions(): void {
  useEffect(() => createTodoInvalidationSubscriptions(window.api.todos, useAppStore.getState()), [])
}
