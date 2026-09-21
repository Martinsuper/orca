import { describe, expect, it, vi } from 'vitest'
import type { Todo, TodoList } from '../../../shared/types'

const { scheduleSaveMock } = vi.hoisted(() => ({ scheduleSaveMock: vi.fn() }))

vi.mock('./write-scheduling', () => ({ scheduleSave: scheduleSaveMock }))

import { TodoPersistence } from './todo-persistence'

type TodoState = ConstructorParameters<typeof TodoPersistence>[0]['state']

function makeState(overrides: Partial<TodoState> = {}): TodoState {
  return {
    todosByRepo: {},
    todoListsByRepo: {},
    globalTodos: [],
    globalTodoLists: [],
    ...overrides
  }
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    repoId: '',
    title: 'Task',
    note: '',
    done: false,
    createdAt: 1,
    updatedAt: 1,
    listId: 'custom',
    ...overrides
  }
}

function makeList(id: string, repoId: string): TodoList {
  return { id, repoId, title: id, createdAt: 1, updatedAt: 1 }
}

function makePersistence(state: TodoState): TodoPersistence {
  return new TodoPersistence({ state })
}

describe('TodoPersistence', () => {
  it('migrates global list tasks without creating an empty-repo project bucket', () => {
    const state = makeState({
      globalTodoLists: [makeList('default', ''), makeList('custom', '')],
      globalTodos: [makeTodo()]
    })
    const persistence = makePersistence(state)

    persistence.removeTodoList('', 'custom')

    expect(state.globalTodoLists?.map((list) => list.id)).toEqual(['default'])
    expect(state.globalTodos?.[0].listId).toBe('default')
    expect(state.todoListsByRepo?.['']).toBeUndefined()
    expect(state.todosByRepo['']).toBeUndefined()
  })

  it('clears reminder state when completing project and global tasks', () => {
    const state = makeState({
      todosByRepo: {
        'repo-1': [
          makeTodo({
            repoId: 'repo-1',
            reminderAt: 100,
            reminderDeliveredAt: 90
          })
        ]
      },
      globalTodos: [makeTodo({ id: 'global-1', reminderAt: 200, reminderDeliveredAt: 190 })]
    })
    const persistence = makePersistence(state)

    const project = persistence.toggleTodo('repo-1', 'todo-1', true)
    const global = persistence.toggleGlobalTodo('global-1', true)

    expect(project).toMatchObject({
      done: true,
      reminderAt: undefined,
      reminderDeliveredAt: undefined
    })
    expect(global).toMatchObject({
      done: true,
      reminderAt: undefined,
      reminderDeliveredAt: undefined
    })
  })
})
