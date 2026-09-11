import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'

export function createTodosInvalidationActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<
  TodosSlice,
  | 'setTodoScope'
  | 'invalidateTodos'
  | 'invalidateGlobalTodos'
  | 'invalidateTodoLists'
  | 'invalidateGlobalTodoLists'
> {
  return {
    setTodoScope: (scope) => {
      set({ todoScope: scope })
    },

    invalidateTodos: (repoId) => {
      set((s) => {
        if (s.todosByRepo[repoId] === undefined) {
          return {}
        }
        const todosByRepo = { ...s.todosByRepo }
        delete todosByRepo[repoId]
        const loadingByRepo = { ...s.todosLoadingByRepo }
        delete loadingByRepo[repoId]
        const statusByRepo = { ...s.todosLoadStatusByRepo }
        delete statusByRepo[repoId]
        return {
          todosByRepo,
          todosLoadingByRepo: loadingByRepo,
          todosLoadStatusByRepo: statusByRepo
        }
      })
      get().fetchTodos(repoId)
    },

    invalidateGlobalTodos: () => {
      if (get().globalTodos === undefined) {
        return
      }
      set(() => ({
        globalTodos: undefined,
        globalTodosLoading: false,
        globalTodosLoadStatus: 'idle'
      }))
      get().fetchGlobalTodos()
    },

    invalidateTodoLists: (repoId) => {
      set((s) => {
        if (s.todoListsByRepo[repoId] === undefined) {
          return {}
        }
        const todoListsByRepo = { ...s.todoListsByRepo }
        delete todoListsByRepo[repoId]
        const loadingByRepo = { ...s.todoListsLoadingByRepo }
        delete loadingByRepo[repoId]
        return { todoListsByRepo, todoListsLoadingByRepo: loadingByRepo }
      })
      get().fetchTodoLists(repoId)
    },

    invalidateGlobalTodoLists: () => {
      if (get().globalTodoLists === undefined) {
        return
      }
      set(() => ({
        globalTodoLists: undefined,
        globalTodoListsLoading: false
      }))
      get().fetchGlobalTodoLists()
    }
  }
}
