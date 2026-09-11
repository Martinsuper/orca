import { toast } from 'sonner'
import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'
import { ERROR_TOAST_DURATION, compareTodos } from './todos-slice-contract'

export function createTodosRepoActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<TodosSlice, 'fetchTodos' | 'saveTodo' | 'removeTodo' | 'toggleTodo'> {
  return {
    fetchTodos: async (repoId) => {
      const state = get()
      if (state.todosByRepo[repoId] !== undefined || state.todosLoadingByRepo[repoId]) {
        return
      }
      set((s) => ({
        todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: true },
        todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loading' },
        todosErrorByRepo: { ...s.todosErrorByRepo, [repoId]: undefined }
      }))
      try {
        const todos = await window.api.todos.list({ repoId })
        set((s) => ({
          todosByRepo: { ...s.todosByRepo, [repoId]: todos },
          todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
          todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'loaded' },
          todosErrorByRepo: { ...s.todosErrorByRepo, [repoId]: undefined }
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set((s) => ({
          todosLoadingByRepo: { ...s.todosLoadingByRepo, [repoId]: false },
          todosLoadStatusByRepo: { ...s.todosLoadStatusByRepo, [repoId]: 'error' },
          todosErrorByRepo: { ...s.todosErrorByRepo, [repoId]: message }
        }))
        console.error(`Failed to fetch todos for repo ${repoId}:`, err)
      }
    },

    saveTodo: async (args) => {
      try {
        if (get().todosByRepo[args.repoId] === undefined) {
          await get().fetchTodos(args.repoId)
          if (get().todosByRepo[args.repoId] === undefined) {
            toast.error('Failed to save todo', {
              description: 'Todos must load before saving.',
              duration: ERROR_TOAST_DURATION
            })
            return null
          }
        }
        const saved = await window.api.todos.save(args)
        set((s) => {
          const existing = s.todosByRepo[args.repoId]
          if (existing === undefined) {
            return {}
          }
          const without = existing.filter((todo) => todo.id !== saved.id)
          return {
            todosByRepo: {
              ...s.todosByRepo,
              [args.repoId]: [...without, saved].sort(compareTodos)
            }
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

    removeTodo: async ({ repoId, todoId }) => {
      const previous = get().todosByRepo[repoId] ?? []
      set((s) => ({
        todosByRepo: {
          ...s.todosByRepo,
          [repoId]: previous.filter((todo) => todo.id !== todoId)
        }
      }))
      try {
        await window.api.todos.remove({ repoId, todoId })
        toast.success('Todo removed')
      } catch (err) {
        set((s) => ({
          todosByRepo: { ...s.todosByRepo, [repoId]: previous }
        }))
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
      set((s) => ({
        todosByRepo: {
          ...s.todosByRepo,
          [repoId]: previous.map((todo) => (todo.id === todoId ? { ...todo, done } : todo))
        }
      }))
      try {
        const updated = await window.api.todos.toggle({ repoId, todoId, done })
        set((s) => ({
          todosByRepo: {
            ...s.todosByRepo,
            [repoId]: (s.todosByRepo[repoId] ?? []).map((todo) =>
              todo.id === updated.id ? updated : todo
            )
          }
        }))
      } catch (err) {
        set((s) => ({
          todosByRepo: { ...s.todosByRepo, [repoId]: previous }
        }))
        const message = err instanceof Error ? err.message : String(err)
        toast.error('Failed to toggle todo', {
          description: message,
          duration: ERROR_TOAST_DURATION
        })
      }
    }
  }
}
