import { toast } from 'sonner'
import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'
import { ERROR_TOAST_DURATION } from './todos-slice-contract'

export function createTodosRepoListActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<TodosSlice, 'fetchTodoLists' | 'saveTodoList' | 'removeTodoList'> {
  return {
    fetchTodoLists: async (repoId) => {
      const state = get()
      if (state.todoListsByRepo[repoId] !== undefined || state.todoListsLoadingByRepo[repoId]) {
        return
      }
      set((s) => ({
        todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [repoId]: true }
      }))
      try {
        const lists = await window.api.todos.listLists({ repoId })
        set((s) => ({
          todoListsByRepo: { ...s.todoListsByRepo, [repoId]: lists },
          todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [repoId]: false }
        }))
      } catch (err) {
        set((s) => ({
          todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [repoId]: false }
        }))
        console.error(`Failed to fetch todo lists for repo ${repoId}:`, err)
      }
    },

    saveTodoList: async (args) => {
      try {
        const saved = await window.api.todos.saveList(args)
        set((s) => {
          const existing = s.todoListsByRepo[args.repoId] ?? []
          const without = existing.filter((l) => l.id !== saved.id)
          return {
            todoListsByRepo: {
              ...s.todoListsByRepo,
              [args.repoId]: [...without, saved].sort((a, b) => a.createdAt - b.createdAt)
            }
          }
        })
        toast.success(args.id ? 'List updated' : 'List created', { description: saved.title })
        return saved
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(args.id ? 'Failed to update list' : 'Failed to create list', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
        return null
      }
    },

    removeTodoList: async ({ repoId, listId }) => {
      const previousLists = get().todoListsByRepo[repoId] ?? []
      const previousTodos = get().todosByRepo[repoId] ?? []
      set((s) => ({
        todoListsByRepo: {
          ...s.todoListsByRepo,
          [repoId]: previousLists.filter((l) => l.id !== listId)
        }
      }))
      try {
        await window.api.todos.removeList({ repoId, listId, confirmed: true })
        await get().fetchTodos(repoId)
        toast.success('List removed')
      } catch (err) {
        set((s) => ({
          todoListsByRepo: { ...s.todoListsByRepo, [repoId]: previousLists },
          todosByRepo: { ...s.todosByRepo, [repoId]: previousTodos }
        }))
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to remove list', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    }
  }
}
