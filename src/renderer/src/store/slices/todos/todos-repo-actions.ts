import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'
import { ERROR_TOAST_DURATION, compareTodos } from './todos-slice-contract'

export function createTodosRepoActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<TodosSlice, 'fetchTodos' | 'saveTodo' | 'removeTodo' | 'toggleTodo'> {
  return {
    fetchTodos: async (repoId, options) => {
      const state = get()
      if (
        !options?.force &&
        (state.todosByRepo[repoId] !== undefined || state.todosLoadingByRepo[repoId])
      ) {
        return
      }
      let generation = 0
      set((s) => {
        generation = (s.todosRequestGenerationByRepo[repoId] ?? 0) + 1
        const hasCachedTodos = s.todosByRepo[repoId] !== undefined
        return {
          todosRequestGenerationByRepo: {
            ...s.todosRequestGenerationByRepo,
            [repoId]: generation
          },
          todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: true },
          todosLoadStatusByRepo: {
            ...s.todosLoadStatusByRepo,
            [repoId]: hasCachedTodos ? 'loaded' : 'loading'
          },
          todosErrorByRepo: { ...s.todosErrorByRepo, [repoId]: undefined }
        }
      })
      try {
        const todos = await window.api.todos.list({ repoId })
        set((s) => {
          if (s.todosRequestGenerationByRepo[repoId] !== generation) {
            return {}
          }
          return {
            todosByRepo: { ...s.todosByRepo, [repoId]: todos },
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
            todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loaded' },
            todosErrorByRepo: { ...s.todosErrorByRepo, [repoId]: undefined }
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set((s) => {
          if (s.todosRequestGenerationByRepo[repoId] !== generation) {
            return {}
          }
          return {
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
            todosLoadStatusByRepo: {
              ...s.todosLoadStatusByRepo,
              [repoId]: s.todosByRepo[repoId] === undefined ? 'error' : 'loaded'
            },
            todosErrorByRepo: { ...s.todosErrorByRepo, [repoId]: message }
          }
        })
        console.error(`Failed to fetch todos for repo ${repoId}:`, err)
      }
    },

    saveTodo: async (args) => {
      try {
        if (get().todosByRepo[args.repoId] === undefined) {
          await get().fetchTodos(args.repoId)
          if (get().todosByRepo[args.repoId] === undefined) {
            toast.error('Failed to save todo', {
              description: translate(
                'auto.store.slices.todos.todosMustLoadBeforeSaving',
                'Todos must load before saving.'
              ),
              duration: ERROR_TOAST_DURATION
            })
            return null
          }
        }
        const saved = await window.api.todos.save(args)
        let applied = false
        set((s) => {
          const existing = s.todosByRepo[args.repoId]
          if (existing === undefined) {
            return {}
          }
          applied = true
          const without = existing.filter((todo) => todo.id !== saved.id)
          return {
            todosByRepo: {
              ...s.todosByRepo,
              [args.repoId]: [...without, saved].sort(compareTodos)
            },
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [args.repoId]: false },
            todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [args.repoId]: 'loaded' },
            todosRequestGenerationByRepo: {
              ...s.todosRequestGenerationByRepo,
              [args.repoId]: (s.todosRequestGenerationByRepo[args.repoId] ?? 0) + 1
            }
          }
        })
        if (applied) {
          get().invalidateTodos(args.repoId)
        }
        toast.success(args.id ? 'Todo updated' : 'Todo saved', { description: saved.title })
        return saved
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(args.id ? 'Failed to update todo' : 'Failed to save todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
        return null
      }
    },

    removeTodo: async ({ repoId, todoId }) => {
      const previous = get().todosByRepo[repoId] ?? []
      let generation = 0
      set((s) => {
        generation = (s.todosRequestGenerationByRepo[repoId] ?? 0) + 1
        return {
          todosByRepo: {
            ...s.todosByRepo,
            [repoId]: previous.filter((todo) => todo.id !== todoId)
          },
          todosRequestGenerationByRepo: { ...s.todosRequestGenerationByRepo, [repoId]: generation }
        }
      })
      try {
        await window.api.todos.remove({ repoId, todoId })
        set((s) => {
          if (
            s.todosByRepo[repoId] === undefined ||
            s.todosRequestGenerationByRepo[repoId] !== generation
          ) {
            return {}
          }
          return {
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
            todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loaded' }
          }
        })
        get().invalidateTodos(repoId)
        toast.success('Todo removed')
      } catch (err) {
        let rolledBack = false
        set((s) => {
          if (
            s.todosByRepo[repoId] === undefined ||
            s.todosRequestGenerationByRepo[repoId] !== generation
          ) {
            return {}
          }
          rolledBack = true
          return {
            todosByRepo: { ...s.todosByRepo, [repoId]: previous },
            todosRequestGenerationByRepo: {
              ...s.todosRequestGenerationByRepo,
              [repoId]: generation + 1
            },
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
            todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loaded' }
          }
        })
        if (rolledBack) {
          get().invalidateTodos(repoId)
        }
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to remove todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
        throw err
      }
    },

    toggleTodo: async ({ repoId, todoId, done }) => {
      const previous = get().todosByRepo[repoId] ?? []
      let generation = 0
      set((s) => {
        generation = (s.todosRequestGenerationByRepo[repoId] ?? 0) + 1
        return {
          todosByRepo: {
            ...s.todosByRepo,
            [repoId]: previous.map((todo) => (todo.id === todoId ? { ...todo, done } : todo))
          },
          todosRequestGenerationByRepo: { ...s.todosRequestGenerationByRepo, [repoId]: generation }
        }
      })
      try {
        const updated = await window.api.todos.toggle({ repoId, todoId, done })
        let applied = false
        set((s) => {
          if (
            s.todosByRepo[repoId] === undefined ||
            s.todosRequestGenerationByRepo[repoId] !== generation
          ) {
            return {}
          }
          applied = true
          return {
            todosByRepo: {
              ...s.todosByRepo,
              [repoId]: s.todosByRepo[repoId].map((todo) =>
                todo.id === updated.id ? updated : todo
              )
            },
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
            todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loaded' }
          }
        })
        if (applied) {
          get().invalidateTodos(repoId)
        }
      } catch (err) {
        let rolledBack = false
        set((s) => {
          if (
            s.todosByRepo[repoId] === undefined ||
            s.todosRequestGenerationByRepo[repoId] !== generation
          ) {
            return {}
          }
          rolledBack = true
          return {
            todosByRepo: { ...s.todosByRepo, [repoId]: previous },
            todosRequestGenerationByRepo: {
              ...s.todosRequestGenerationByRepo,
              [repoId]: generation + 1
            },
            todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
            todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loaded' }
          }
        })
        if (rolledBack) {
          get().invalidateTodos(repoId)
        }
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to toggle todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    }
  }
}
