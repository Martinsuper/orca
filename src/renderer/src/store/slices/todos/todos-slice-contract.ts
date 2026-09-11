import type { StateCreator } from 'zustand'
import type { AppState } from '../../types'
import type { Todo, TodoList, TodoStep } from '../../../../../shared/types'

export type TodosLoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type TodoSaveArgs = {
  repoId: string
  id?: string
  listId?: string
  title: string
  note?: string
  important?: boolean
  dueDate?: string
  reminderAt?: number
  myDayDate?: string
  steps?: TodoStep[]
}

type TodosSliceState = {
  todosByRepo: Record<string, Todo[]>
  todosLoadingByRepo: Record<string, boolean>
  todosLoadStatusByRepo: Record<string, TodosLoadStatus>
  todosErrorByRepo: Record<string, string | undefined>
  todoListsByRepo: Record<string, TodoList[]>
  todoListsLoadingByRepo: Record<string, boolean>
  globalTodos: Todo[] | undefined
  globalTodosLoading: boolean
  globalTodosLoadStatus: TodosLoadStatus
  globalTodosError: string | undefined
  globalTodoLists: TodoList[] | undefined
  globalTodoListsLoading: boolean
  todoScope: 'project' | 'global'
  fetchTodos: (repoId: string) => Promise<void>
  saveTodo: (args: TodoSaveArgs) => Promise<Todo | null>
  removeTodo: (args: { repoId: string; todoId: string }) => Promise<void>
  toggleTodo: (args: { repoId: string; todoId: string; done: boolean }) => Promise<void>
  fetchTodoLists: (repoId: string) => Promise<void>
  saveTodoList: (args: { repoId: string; id?: string; title: string }) => Promise<TodoList | null>
  removeTodoList: (args: { repoId: string; listId: string }) => Promise<void>
  fetchGlobalTodos: () => Promise<void>
  saveGlobalTodo: (args: Omit<TodoSaveArgs, 'repoId'>) => Promise<Todo | null>
  removeGlobalTodo: (args: { todoId: string }) => Promise<void>
  toggleGlobalTodo: (args: { todoId: string; done: boolean }) => Promise<void>
  fetchGlobalTodoLists: () => Promise<void>
  saveGlobalTodoList: (args: { id?: string; title: string }) => Promise<TodoList | null>
  removeGlobalTodoList: (args: { listId: string }) => Promise<void>
  setTodoScope: (scope: 'project' | 'global') => void
  invalidateTodos: (repoId: string) => void
  invalidateGlobalTodos: () => void
  invalidateTodoLists: (repoId: string) => void
  invalidateGlobalTodoLists: () => void
}

export type TodosSlice = TodosSliceState

export const ERROR_TOAST_DURATION = 60_000

type TodosStateCreator = StateCreator<AppState, [], [], TodosSlice>
export type TodosSliceSet = Parameters<TodosStateCreator>[0]
export type TodosSliceGet = Parameters<TodosStateCreator>[1]

export function compareTodos(left: Todo, right: Todo): number {
  return left.createdAt - right.createdAt
}

export function isTodoInMyDay(todo: Todo, localDate: string): boolean {
  return !todo.done && todo.myDayDate === localDate
}

export function getMyDayTodos(
  repoTodos: Record<string, Todo[]> | undefined,
  globalTodos: Todo[] | undefined,
  localDate: string
): Todo[] {
  const result: Todo[] = []
  for (const todo of globalTodos ?? []) {
    if (isTodoInMyDay(todo, localDate)) {
      result.push(todo)
    }
  }
  for (const todos of Object.values(repoTodos ?? {})) {
    for (const todo of todos) {
      if (isTodoInMyDay(todo, localDate)) {
        result.push(todo)
      }
    }
  }
  return result.sort(compareTodos)
}
