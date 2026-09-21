import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { TodosSlice } from './todos-slice-contract'
import { createTodosRepoActions } from './todos-repo-actions'
import { createTodosRepoListActions } from './todos-repo-list-actions'
import { createTodosGlobalActions } from './todos-global-actions'
import { createTodosInvalidationActions } from './todos-invalidation-actions'

export const createTodosSlice: StateCreator<AppState, [], [], TodosSlice> = (set, get) => ({
  todosByRepo: {},
  todosLoadingByRepo: {},
  todosLoadStatusByRepo: {},
  todosErrorByRepo: {},
  todosRequestGenerationByRepo: {},
  todoListsByRepo: {},
  todoListsLoadingByRepo: {},
  todoListsRequestGenerationByRepo: {},
  globalTodos: undefined,
  globalTodosLoading: false,
  globalTodosLoadStatus: 'idle',
  globalTodosError: undefined,
  globalTodosRequestGeneration: 0,
  globalTodoLists: undefined,
  globalTodoListsLoading: false,
  globalTodoListsRequestGeneration: 0,
  todoScope: 'project',
  todoNavigationByScope: {},

  ...createTodosRepoActions(set, get),
  ...createTodosRepoListActions(set, get),
  ...createTodosGlobalActions(set, get),
  ...createTodosInvalidationActions(set, get)
})
