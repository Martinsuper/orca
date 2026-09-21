import type { TodosSlice, TodosSliceGet, TodosSliceSet } from './todos-slice-contract'

export function createTodosInvalidationActions(
  set: TodosSliceSet,
  get: TodosSliceGet
): Pick<
  TodosSlice,
  | 'setTodoScope'
  | 'setTodoNavigation'
  | 'invalidateTodos'
  | 'invalidateGlobalTodos'
  | 'invalidateTodoLists'
  | 'invalidateGlobalTodoLists'
> {
  return {
    setTodoScope: (scope) => {
      set({ todoScope: scope })
    },

    setTodoNavigation: (scopeKey, target) => {
      set((s) => ({
        todoNavigationByScope: { ...s.todoNavigationByScope, [scopeKey]: target }
      }))
    },

    invalidateTodos: (repoId) => {
      const state = get()
      if (state.todosByRepo[repoId] !== undefined || state.todosLoadingByRepo[repoId] === true) {
        void get().fetchTodos(repoId, { force: true })
      }
    },

    invalidateGlobalTodos: () => {
      const state = get()
      if (state.globalTodos !== undefined || state.globalTodosLoading) {
        void get().fetchGlobalTodos({ force: true })
      }
    },

    invalidateTodoLists: (repoId) => {
      const state = get()
      if (
        state.todoListsByRepo[repoId] !== undefined ||
        state.todoListsLoadingByRepo[repoId] === true
      ) {
        void get().fetchTodoLists(repoId, { force: true })
      }
    },

    invalidateGlobalTodoLists: () => {
      const state = get()
      if (state.globalTodoLists !== undefined || state.globalTodoListsLoading) {
        void get().fetchGlobalTodoLists({ force: true })
      }
    }
  }
}
