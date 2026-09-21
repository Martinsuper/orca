import { toast } from 'sonner'
import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'
import { ERROR_TOAST_DURATION } from './todos-slice-contract'

export function createTodosRepoListActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<TodosSlice, 'fetchTodoLists' | 'saveTodoList' | 'removeTodoList'> {
  return {
    fetchTodoLists: async (repoId, options) => {
      const state = get()
      if (
        !options?.force &&
        (state.todoListsByRepo[repoId] !== undefined || state.todoListsLoadingByRepo[repoId])
      ) {
        return
      }
      let generation = 0
      set((s) => {
        generation = (s.todoListsRequestGenerationByRepo[repoId] ?? 0) + 1
        return {
          todoListsRequestGenerationByRepo: {
            ...s.todoListsRequestGenerationByRepo,
            [repoId]: generation
          },
          todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [repoId]: true }
        }
      })
      try {
        const lists = await window.api.todos.listLists({ repoId })
        set((s) => {
          if (
            s.todoListsLoadingByRepo[repoId] !== true ||
            (s.todoListsRequestGenerationByRepo[repoId] ?? 0) !== generation
          ) {
            return {}
          }
          return {
            todoListsByRepo: { ...s.todoListsByRepo, [repoId]: lists },
            todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [repoId]: false }
          }
        })
      } catch (err) {
        set((s) => {
          if (
            s.todoListsLoadingByRepo[repoId] !== true ||
            (s.todoListsRequestGenerationByRepo[repoId] ?? 0) !== generation
          ) {
            return {}
          }
          return {
            todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [repoId]: false }
          }
        })
        console.error(`Failed to fetch todo lists for repo ${repoId}:`, err)
      }
    },

    saveTodoList: async (args) => {
      try {
        const saved = await window.api.todos.saveList(args)
        let applied = false
        set((s) => {
          const existing = s.todoListsByRepo[args.repoId]
          if (existing === undefined) {
            return {}
          }
          applied = true
          const without = existing.filter((list) => list.id !== saved.id)
          return {
            todoListsByRepo: {
              ...s.todoListsByRepo,
              [args.repoId]: [...without, saved].sort((a, b) => a.createdAt - b.createdAt)
            },
            todoListsLoadingByRepo: { ...s.todoListsLoadingByRepo, [args.repoId]: false },
            todoListsRequestGenerationByRepo: {
              ...s.todoListsRequestGenerationByRepo,
              [args.repoId]: (s.todoListsRequestGenerationByRepo[args.repoId] ?? 0) + 1
            }
          }
        })
        if (applied) {
          get().invalidateTodoLists(args.repoId)
        }
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
      let generation = 0
      set((s) => {
        generation = (s.todoListsRequestGenerationByRepo[repoId] ?? 0) + 1
        return {
          todoListsByRepo: {
            ...s.todoListsByRepo,
            [repoId]: previousLists.filter((list) => list.id !== listId)
          },
          todoListsRequestGenerationByRepo: {
            ...s.todoListsRequestGenerationByRepo,
            [repoId]: generation
          }
        }
      })
      try {
        await window.api.todos.removeList({ repoId, listId, confirmed: true })
        if (get().todoListsRequestGenerationByRepo[repoId] === generation) {
          get().invalidateTodos(repoId)
          get().invalidateTodoLists(repoId)
        }
        toast.success('List removed')
      } catch (err) {
        if (
          get().todoListsByRepo[repoId] !== undefined &&
          get().todoListsRequestGenerationByRepo[repoId] === generation
        ) {
          set((s) => ({
            todoListsByRepo: { ...s.todoListsByRepo, [repoId]: previousLists },
            todoListsRequestGenerationByRepo: {
              ...s.todoListsRequestGenerationByRepo,
              [repoId]: generation + 1
            }
          }))
          get().invalidateTodoLists(repoId)
        }
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to remove list', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    }
  }
}
