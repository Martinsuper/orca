import { toast } from 'sonner'
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
    fetchGlobalTodos: async () => {
      const state = get()
      if (state.globalTodos !== undefined || state.globalTodosLoading) {
        return
      }
      set(() => ({
        globalTodosLoading: true,
        globalTodosLoadStatus: 'loading',
        globalTodosError: undefined
      }))
      try {
        const todos = await window.api.todos.listGlobal()
        set(() => ({
          globalTodos: todos,
          globalTodosLoading: false,
          globalTodosLoadStatus: 'loaded',
          globalTodosError: undefined
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set(() => ({
          globalTodosLoading: false,
          globalTodosLoadStatus: 'error',
          globalTodosError: message
        }))
        console.error('Failed to fetch global todos:', err)
      }
    },

    saveGlobalTodo: async (args) => {
      try {
        if (get().globalTodos === undefined) {
          await get().fetchGlobalTodos()
          if (get().globalTodos === undefined) {
            toast.error('Failed to save todo', {
              description: 'Todos must load before saving.',
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
            globalTodos: [...without, saved].sort(compareTodos)
          }
        })
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
      set(() => ({
        globalTodos: previous.filter((todo) => todo.id !== todoId)
      }))
      try {
        await window.api.todos.removeGlobal({ todoId })
        toast.success('Todo removed')
      } catch (err) {
        set(() => ({ globalTodos: previous }))
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
      set(() => ({
        globalTodos: previous.map((todo) => (todo.id === todoId ? { ...todo, done } : todo))
      }))
      try {
        const updated = await window.api.todos.toggleGlobal({ todoId, done })
        set((s) => ({
          globalTodos: (s.globalTodos ?? []).map((todo) =>
            todo.id === updated.id ? updated : todo
          )
        }))
      } catch (err) {
        set(() => ({ globalTodos: previous }))
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to toggle todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    },

    fetchGlobalTodoLists: async () => {
      if (get().globalTodoLists !== undefined || get().globalTodoListsLoading) {
        return
      }
      set(() => ({ globalTodoListsLoading: true }))
      try {
        const lists = await window.api.todos.listGlobalLists()
        set(() => ({
          globalTodoLists: lists,
          globalTodoListsLoading: false
        }))
      } catch (err) {
        set(() => ({ globalTodoListsLoading: false }))
        console.error('Failed to fetch global todo lists:', err)
      }
    },

    saveGlobalTodoList: async (args) => {
      try {
        const saved = await window.api.todos.saveGlobalList(args)
        set((s) => {
          const existing = s.globalTodoLists ?? []
          const without = existing.filter((l) => l.id !== saved.id)
          return {
            globalTodoLists: [...without, saved].sort((a, b) => a.createdAt - b.createdAt)
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

    removeGlobalTodoList: async ({ listId }) => {
      const previousLists = get().globalTodoLists ?? []
      set(() => ({
        globalTodoLists: previousLists.filter((l) => l.id !== listId)
      }))
      try {
        await window.api.todos.removeGlobalList({ listId, confirmed: true })
        await get().fetchGlobalTodos()
        toast.success('List removed')
      } catch (err) {
        set(() => ({ globalTodoLists: previousLists }))
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to remove list', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    }
  }
}
