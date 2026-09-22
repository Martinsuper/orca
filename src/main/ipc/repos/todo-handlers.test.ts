import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo, TodoList } from '../../../shared/types'

const handlers = new Map<string, (...args: unknown[]) => unknown>()
const { getAllWindowsMock, handleMock, removeHandlerMock } = vi.hoisted(() => ({
  getAllWindowsMock: vi.fn(),
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: getAllWindowsMock },
  ipcMain: { handle: handleMock, removeHandler: removeHandlerMock }
}))

import {
  registerTodoEventRenderer,
  unregisterTodoEventRenderer
} from '../../window/todo-event-renderers'
import { registerTodoHandlers } from './todo-handlers'

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    repoId: 'repo-1',
    title: 'Task',
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

function makeList(id: string, repoId: string): TodoList {
  return { id, repoId, title: id, createdAt: 1, updatedAt: 1 }
}

function makeStore() {
  const todosByRepo: Record<string, Todo[]> = { 'repo-1': [] }
  const globalTodos: Todo[] = []
  const listsByRepo: Record<string, TodoList[]> = {
    'repo-1': [makeList('default', 'repo-1'), makeList('project-list', 'repo-1')]
  }
  const globalLists = [makeList('default', ''), makeList('global-list', '')]
  return {
    getRepo: vi.fn((repoId: string) => (repoId === 'repo-1' ? { id: repoId } : undefined)),
    getTodos: vi.fn((repoId: string) => todosByRepo[repoId] ?? []),
    getGlobalTodos: vi.fn(() => globalTodos),
    getTodoLists: vi.fn((repoId: string) => listsByRepo[repoId] ?? []),
    getGlobalTodoLists: vi.fn(() => globalLists),
    saveTodo: vi.fn((todo: Todo) => {
      const todos = todosByRepo[todo.repoId] ?? []
      const index = todos.findIndex((entry) => entry.id === todo.id)
      todosByRepo[todo.repoId] =
        index === -1 ? [...todos, todo] : todos.map((entry, i) => (i === index ? todo : entry))
      return todo
    }),
    saveGlobalTodo: vi.fn((todo: Todo) => {
      const index = globalTodos.findIndex((entry) => entry.id === todo.id)
      if (index === -1) {
        globalTodos.push(todo)
      } else {
        globalTodos[index] = todo
      }
      return todo
    }),
    removeTodo: vi.fn(),
    toggleTodo: vi.fn(),
    saveTodoList: vi.fn((list: TodoList) => list),
    removeTodoList: vi.fn(),
    removeGlobalTodo: vi.fn(),
    toggleGlobalTodo: vi.fn(),
    saveGlobalTodoList: vi.fn((list: TodoList) => list),
    removeGlobalTodoList: vi.fn()
  }
}

function handler(channel: string): (...args: unknown[]) => unknown {
  const registered = handlers.get(channel)
  if (!registered) {
    throw new Error(`Missing ${channel} handler`)
  }
  return registered
}

function isTodo(value: unknown): value is Todo {
  return (
    !!value &&
    typeof value === 'object' &&
    'id' in value &&
    'repoId' in value &&
    'title' in value &&
    'done' in value
  )
}

function expectTodo(value: unknown): Todo {
  if (!isTodo(value)) {
    throw new Error('Expected Todo result')
  }
  return value
}

describe('todo handlers', () => {
  beforeEach(() => {
    handlers.clear()
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    getAllWindowsMock.mockReset()
    getAllWindowsMock.mockReturnValue([])
    handleMock.mockImplementation(
      (channel: string, registered: (...args: unknown[]) => unknown) => {
        handlers.set(channel, registered)
      }
    )
  })

  it('preserves undefined fields, clears null fields, rejects nonfinite reminders, and resets delivery after a reminder change', () => {
    const store = makeStore()
    const existing = makeTodo({
      dueDate: '2026-09-21',
      reminderAt: 100,
      reminderDeliveredAt: 101,
      myDayDate: '2026-09-20'
    })
    store.saveTodo(existing)
    registerTodoHandlers(undefined, store)

    const unchanged = expectTodo(
      handler('todos:save')(null, {
        repoId: 'repo-1',
        id: existing.id,
        title: 'Task'
      })
    )
    expect(unchanged).toMatchObject({
      dueDate: '2026-09-21',
      reminderAt: 100,
      reminderDeliveredAt: 101,
      myDayDate: '2026-09-20'
    })

    const cleared = expectTodo(
      handler('todos:save')(null, {
        repoId: 'repo-1',
        id: existing.id,
        title: 'Task',
        dueDate: null,
        reminderAt: null,
        myDayDate: null
      })
    )
    expect(cleared.dueDate).toBeUndefined()
    expect(cleared.reminderAt).toBeUndefined()
    expect(cleared.reminderDeliveredAt).toBeUndefined()
    expect(cleared.myDayDate).toBeUndefined()

    expect(() =>
      handler('todos:save')(null, {
        repoId: 'repo-1',
        id: existing.id,
        title: 'Task',
        reminderAt: Number.NaN
      })
    ).toThrow('Reminder time must be finite.')
    expect(() =>
      handler('todos:save')(null, {
        repoId: 'repo-1',
        id: existing.id,
        title: 'Task',
        myDayDate: '2026-9-20'
      })
    ).toThrow('My Day date must be in YYYY-MM-DD format.')

    const changed = expectTodo(
      handler('todos:save')(null, {
        repoId: 'repo-1',
        id: existing.id,
        title: 'Task',
        reminderAt: 200
      })
    )
    expect(changed).toMatchObject({ reminderAt: 200, reminderDeliveredAt: undefined })
  })

  it('rejects stale ids and lists from another scope', () => {
    const store = makeStore()
    registerTodoHandlers(undefined, store)

    expect(() =>
      handler('todos:save')(null, { repoId: 'repo-1', id: 'missing', title: 'Task' })
    ).toThrow('Todo "missing" not found')
    expect(() => handler('todos:saveGlobal')(null, { id: 'missing', title: 'Task' })).toThrow(
      'Global todo "missing" not found'
    )
    expect(() =>
      handler('todos:save')(null, { repoId: 'repo-1', listId: 'global-list', title: 'Task' })
    ).toThrow('Todo list "global-list" not found in repo "repo-1"')
  })

  it('broadcasts all invalidations to every registered main renderer only', () => {
    const store = makeStore()
    const firstSend = vi.fn()
    const secondSend = vi.fn()
    const externalSend = vi.fn()
    const destroyedSend = vi.fn()
    const first = {
      isDestroyed: () => false,
      webContents: { id: 1, isDestroyed: () => false, send: firstSend }
    }
    const second = {
      isDestroyed: () => false,
      webContents: { id: 2, isDestroyed: () => false, send: secondSend }
    }
    const external = {
      isDestroyed: () => false,
      webContents: { id: 3, isDestroyed: () => false, send: externalSend }
    }
    const destroyed = {
      isDestroyed: () => true,
      webContents: { id: 4, isDestroyed: () => true, send: destroyedSend }
    }
    getAllWindowsMock.mockReturnValue([first, second, external, destroyed])
    registerTodoEventRenderer(first.webContents.id)
    registerTodoEventRenderer(second.webContents.id)
    registerTodoHandlers(undefined, store)

    handler('todos:save')(null, { repoId: 'repo-1', title: 'Project' })
    handler('todos:saveList')(null, { repoId: 'repo-1', title: 'Project list' })
    handler('todos:saveGlobal')(null, { title: 'Global' })
    handler('todos:saveGlobalList')(null, { title: 'Global list' })

    for (const send of [firstSend, secondSend]) {
      expect(send).toHaveBeenCalledWith('todos:changed', { repoId: 'repo-1' })
      expect(send).toHaveBeenCalledWith('todos:listsChanged', { repoId: 'repo-1' })
      expect(send).toHaveBeenCalledWith('todos:globalChanged', undefined)
      expect(send).toHaveBeenCalledWith('todos:globalListsChanged', undefined)
    }
    expect(externalSend).not.toHaveBeenCalled()
    expect(destroyedSend).not.toHaveBeenCalled()
    unregisterTodoEventRenderer(first.webContents.id)
    unregisterTodoEventRenderer(second.webContents.id)
  })

  it('broadcasts list and task invalidations after list migration', () => {
    const store = makeStore()
    const send = vi.fn()
    const window = {
      isDestroyed: () => false,
      webContents: { id: 5, isDestroyed: () => false, send }
    }
    getAllWindowsMock.mockReturnValue([window])
    registerTodoEventRenderer(window.webContents.id)
    registerTodoHandlers(undefined, store)

    handler('todos:removeList')(null, { repoId: 'repo-1', listId: 'project-list', confirmed: true })
    handler('todos:removeGlobalList')(null, { listId: 'global-list', confirmed: true })

    expect(send).toHaveBeenCalledWith('todos:listsChanged', { repoId: 'repo-1' })
    expect(send).toHaveBeenCalledWith('todos:changed', { repoId: 'repo-1' })
    expect(send).toHaveBeenCalledWith('todos:globalListsChanged', undefined)
    expect(send).toHaveBeenCalledWith('todos:globalChanged', undefined)
    unregisterTodoEventRenderer(window.webContents.id)
  })
})
