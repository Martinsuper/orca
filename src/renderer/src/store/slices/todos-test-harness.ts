import { create } from 'zustand'
import { vi, type Mock } from 'vitest'
import type { Todo, TodoList } from '../../../../shared/types'
import type { AppState } from '../types'
import { createTodosSlice } from './todos'

type TodoApiMock = {
  list: Mock
  save: Mock
  remove: Mock
  toggle: Mock
  listLists: Mock
  saveList: Mock
  removeList: Mock
  onChanged: Mock
  onListsChanged: Mock
  listGlobal: Mock
  saveGlobal: Mock
  removeGlobal: Mock
  toggleGlobal: Mock
  onGlobalChanged: Mock
  listGlobalLists: Mock
  saveGlobalList: Mock
  removeGlobalList: Mock
  onGlobalListsChanged: Mock
}

export const mockApi: { todos: TodoApiMock } = {
  todos: {
    list: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    listLists: vi.fn(),
    saveList: vi.fn(),
    removeList: vi.fn(),
    onChanged: vi.fn(),
    onListsChanged: vi.fn(),
    listGlobal: vi.fn(),
    saveGlobal: vi.fn(),
    removeGlobal: vi.fn(),
    toggleGlobal: vi.fn(),
    onGlobalChanged: vi.fn(),
    listGlobalLists: vi.fn(),
    saveGlobalList: vi.fn(),
    removeGlobalList: vi.fn(),
    onGlobalListsChanged: vi.fn()
  }
}

// @ts-expect-error -- test shim
globalThis.window = { api: mockApi }

export function createTestStore() {
  return create<AppState>()((...a) => ({ ...createTodosSlice(...a) }) as AppState)
}

export function makeTodo(overrides: Partial<Todo> & { id: string; repoId: string }): Todo {
  return {
    title: overrides.id,
    note: '',
    done: false,
    createdAt: 1,
    updatedAt: 1,
    listId: 'default',
    important: false,
    steps: [],
    ...overrides
  }
}

export function makeList(overrides: Partial<TodoList> & { id: string; repoId: string }): TodoList {
  return {
    title: overrides.id,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

export function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, resolve, reject }
}

export function resetTodoApiMocks(): void {
  vi.resetAllMocks()
  mockApi.todos.list.mockResolvedValue([])
  mockApi.todos.save.mockImplementation((args: { id?: string; title: string; note?: string }) =>
    Promise.resolve(
      makeTodo({
        id: args.id ?? `todo-${args.title}`,
        repoId: 'repo-1',
        title: args.title,
        note: args.note ?? '',
        updatedAt: 2
      })
    )
  )
  mockApi.todos.remove.mockResolvedValue(undefined)
  mockApi.todos.toggle.mockImplementation((args: { todoId: string; done: boolean }) =>
    Promise.resolve(
      makeTodo({
        id: args.todoId,
        repoId: 'repo-1',
        title: args.todoId,
        done: args.done,
        updatedAt: 3
      })
    )
  )
  mockApi.todos.listLists.mockResolvedValue([])
  mockApi.todos.saveList.mockImplementation(
    (args: { id?: string; title: string; repoId: string }) =>
      Promise.resolve(
        makeList({
          id: args.id ?? `list-${args.title}`,
          repoId: args.repoId,
          title: args.title,
          updatedAt: 2
        })
      )
  )
  mockApi.todos.removeList.mockResolvedValue(undefined)
  mockApi.todos.listGlobal.mockResolvedValue([])
  mockApi.todos.saveGlobal.mockImplementation((args: { id?: string; title: string }) =>
    Promise.resolve(
      makeTodo({
        id: args.id ?? `global-${args.title}`,
        repoId: '',
        title: args.title,
        updatedAt: 2
      })
    )
  )
  mockApi.todos.removeGlobal.mockResolvedValue(undefined)
  mockApi.todos.toggleGlobal.mockImplementation((args: { todoId: string; done: boolean }) =>
    Promise.resolve(
      makeTodo({
        id: args.todoId,
        repoId: '',
        title: args.todoId,
        done: args.done,
        updatedAt: 3
      })
    )
  )
  mockApi.todos.listGlobalLists.mockResolvedValue([])
  mockApi.todos.saveGlobalList.mockImplementation((args: { id?: string; title: string }) =>
    Promise.resolve(
      makeList({
        id: args.id ?? `global-list-${args.title}`,
        repoId: '',
        title: args.title,
        updatedAt: 2
      })
    )
  )
  mockApi.todos.removeGlobalList.mockResolvedValue(undefined)
}
