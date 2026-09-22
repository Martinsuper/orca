import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'
import { ERROR_TOAST_DURATION, compareTodos } from './todos-slice-contract'

export function createTodosGlobalActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<
  TodosSlice,
  | 'fetchGlobalTodos'
  | 'saveGlobalTodo'
  | 'removeGlobalTodo'
  | 'toggleGlobalTodo'
  | 'fetchGlobalTodoLists'
  | 'saveGlobalTodoList'
  | 'removeGlobalTodoList'
> {
  return {
    fetchGlobalTodos: async (options) => {
      const state = get()
      if (!options?.force && (state.globalTodos !== undefined || state.globalTodosLoading)) {
        return
      }
      let generation = 0
      set((s) => {
        generation = s.globalTodosRequestGeneration + 1
        return {
          globalTodosRequestGeneration: generation,
          globalTodosLoading: true,
          globalTodosLoadStatus: s.globalTodos === undefined ? 'loading' : 'loaded',
          globalTodosError: undefined
        }
      })
      try {
        const todos = await window.api.todos.listGlobal()
        set((s) => {
          if (s.globalTodosRequestGeneration !== generation) {
            return {}
          }
          return {
            globalTodos: todos,
            globalTodosLoading: false,
            globalTodosLoadStatus: 'loaded',
            globalTodosError: undefined
          }
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set((s) => {
          if (s.globalTodosRequestGeneration !== generation) {
            return {}
          }
          return {
            globalTodosLoading: false,
            globalTodosLoadStatus: 'error',
            globalTodosError: message
          }
        })
        console.error('Failed to fetch global todos:', err)
      }
    },

    saveGlobalTodo: async (args) => {
      try {
        if (get().globalTodos === undefined) {
          await get().fetchGlobalTodos()
          if (get().globalTodos === undefined) {
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
        const saved = await window.api.todos.saveGlobal(args)
        set((s) => {
          const existing = s.globalTodos ?? []
          const without = existing.filter((todo) => todo.id !== saved.id)
          return {
            globalTodos: [...without, saved].sort(compareTodos),
            globalTodosLoading: false,
            globalTodosLoadStatus: 'loaded',
            globalTodosRequestGeneration: s.globalTodosRequestGeneration + 1
          }
        })
        get().invalidateGlobalTodos()
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

    removeGlobalTodo: async ({ todoId }) => {
      const previous = get().globalTodos ?? []
      let generation = 0
      set((s) => {
        generation = s.globalTodosRequestGeneration + 1
        return {
          globalTodos: previous.filter((todo) => todo.id !== todoId),
          globalTodosRequestGeneration: generation
        }
      })
      try {
        await window.api.todos.removeGlobal({ todoId })
        if (get().globalTodosRequestGeneration === generation) {
          get().invalidateGlobalTodos()
        }
        toast.success('Todo removed')
      } catch (err) {
        if (get().globalTodosRequestGeneration === generation) {
          set((s) => ({
            globalTodos: previous,
            globalTodosRequestGeneration: s.globalTodosRequestGeneration + 1
          }))
          get().invalidateGlobalTodos()
        }
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to remove todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
        throw err
      }
    },

    toggleGlobalTodo: async ({ todoId, done }) => {
      const previous = get().globalTodos ?? []
      let generation = 0
      set((s) => {
        generation = s.globalTodosRequestGeneration + 1
        return {
          globalTodos: previous.map((todo) => (todo.id === todoId ? { ...todo, done } : todo)),
          globalTodosRequestGeneration: generation
        }
      })
      try {
        const updated = await window.api.todos.toggleGlobal({ todoId, done })
        if (get().globalTodosRequestGeneration === generation) {
          set((s) => ({
            globalTodos: (s.globalTodos ?? []).map((todo) =>
              todo.id === updated.id ? updated : todo
            )
          }))
          get().invalidateGlobalTodos()
        }
      } catch (err) {
        if (get().globalTodosRequestGeneration === generation) {
          set((s) => ({
            globalTodos: previous,
            globalTodosRequestGeneration: s.globalTodosRequestGeneration + 1
          }))
          get().invalidateGlobalTodos()
        }
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to toggle todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    },

    fetchGlobalTodoLists: async (options) => {
      const state = get()
      if (
        !options?.force &&
        (state.globalTodoLists !== undefined || state.globalTodoListsLoading)
      ) {
        return
      }
      let generation = 0
      set((s) => {
        generation = s.globalTodoListsRequestGeneration + 1
        return {
          globalTodoListsRequestGeneration: generation,
          globalTodoListsLoading: true
        }
      })
      try {
        const lists = await window.api.todos.listGlobalLists()
        set((s) => {
          if (s.globalTodoListsRequestGeneration !== generation) {
            return {}
          }
          return {
            globalTodoLists: lists,
            globalTodoListsLoading: false
          }
        })
      } catch (err) {
        set((s) => {
          if (s.globalTodoListsRequestGeneration !== generation) {
            return {}
          }
          return { globalTodoListsLoading: false }
        })
        console.error('Failed to fetch global todo lists:', err)
      }
    },

    saveGlobalTodoList: async (args) => {
      try {
        const saved = await window.api.todos.saveGlobalList(args)
        set((s) => {
          const existing = s.globalTodoLists ?? []
          const without = existing.filter((list) => list.id !== saved.id)
          return {
            globalTodoLists: [...without, saved].sort((a, b) => a.createdAt - b.createdAt),
            globalTodoListsLoading: false,
            globalTodoListsRequestGeneration: s.globalTodoListsRequestGeneration + 1
          }
        })
        get().invalidateGlobalTodoLists()
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

    removeGlobalTodoList: async ({ listId }) => {
      const previousLists = get().globalTodoLists ?? []
      let generation = 0
      set((s) => {
        generation = s.globalTodoListsRequestGeneration + 1
        return {
          globalTodoLists: previousLists.filter((list) => list.id !== listId),
          globalTodoListsRequestGeneration: generation
        }
      })
      try {
        await window.api.todos.removeGlobalList({ listId, confirmed: true })
        if (get().globalTodoListsRequestGeneration === generation) {
          get().invalidateGlobalTodos()
          get().invalidateGlobalTodoLists()
        }
        toast.success('List removed')
      } catch (err) {
        if (get().globalTodoListsRequestGeneration === generation) {
          set((s) => ({
            globalTodoLists: previousLists,
            globalTodoListsRequestGeneration: s.globalTodoListsRequestGeneration + 1
          }))
          get().invalidateGlobalTodoLists()
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
