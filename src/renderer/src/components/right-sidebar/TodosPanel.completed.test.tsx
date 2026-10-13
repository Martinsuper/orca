// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { Todo, TodoList } from '../../../../shared/types'

const storeState: Record<string, unknown> = {}
const storeListeners = new Set<() => void>()
let activeRepo: { id: string; displayName: string } | undefined

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) =>
    useSyncExternalStore(
      (listener) => {
        storeListeners.add(listener)
        return () => storeListeners.delete(listener)
      },
      () => selector(storeState)
    )
}))

vi.mock('@/store/selectors', () => ({
  useActiveRepo: () => activeRepo
}))

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

import TodosPanel from './TodosPanel'

const defaultList: TodoList = {
  id: 'default',
  repoId: 'repo-a',
  title: 'Tasks',
  createdAt: 1,
  updatedAt: 1
}

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: 'todo-1',
    repoId: 'repo-a',
    title: 'Done task',
    note: '',
    done: true,
    createdAt: 1,
    updatedAt: 2,
    completedAt: 2,
    listId: 'default',
    important: false,
    steps: [],
    ...overrides
  }
}

function resetStore(): void {
  activeRepo = { id: 'repo-a', displayName: 'Repo A' }
  Object.assign(storeState, {
    repos: [activeRepo],
    todoScope: 'project',
    todoNavigationByScope: { 'project:repo-a': { kind: 'smart-view', view: 'completed' } },
    todosByRepo: { 'repo-a': [makeTodo({})] },
    todosLoadStatusByRepo: { 'repo-a': 'loaded' },
    todosErrorByRepo: {},
    todoListsByRepo: { 'repo-a': [defaultList] },
    todoListsLoadingByRepo: {},
    globalTodos: [],
    globalTodosLoadStatus: 'loaded',
    globalTodosError: undefined,
    globalTodoLists: [{ ...defaultList, repoId: '' }],
    globalTodoListsLoading: false,
    fetchTodos: vi.fn(),
    saveTodo: vi.fn(async () => null),
    removeTodo: vi.fn(async () => undefined),
    toggleTodo: vi.fn(async () => undefined),
    fetchTodoLists: vi.fn(),
    saveTodoList: vi.fn(),
    removeTodoList: vi.fn(),
    fetchGlobalTodos: vi.fn(),
    saveGlobalTodo: vi.fn(async () => null),
    removeGlobalTodo: vi.fn(async () => undefined),
    toggleGlobalTodo: vi.fn(async () => undefined),
    fetchGlobalTodoLists: vi.fn(),
    saveGlobalTodoList: vi.fn(),
    removeGlobalTodoList: vi.fn(),
    setTodoScope: vi.fn(),
    setTodoNavigation: vi.fn()
  })
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  for (const key of Object.keys(storeState)) {
    delete storeState[key]
  }
})

describe('completed todos (regression)', () => {
  it('renders completed rows with reachable edit and delete actions', () => {
    render(<TodosPanel />)
    expect(screen.getByText('Done task')).toBeTruthy()
    expect(screen.getByLabelText('Edit todo')).toBeTruthy()
    expect(screen.getByLabelText('Delete todo')).toBeTruthy()
  })

  it('keeps row content clamped so actions stay inside narrow windows', () => {
    resetStore()
    storeState.todosByRepo = {
      'repo-a': [
        makeTodo({
          note: 'https://joyspace.jd.com/pages/8NTKIlcMudmZtdLZmuVXbOiHLD7CdHlBFdvkaGLI'
        })
      ]
    }
    render(<TodosPanel />)
    const row = screen.getByText(
      'https://joyspace.jd.com/pages/8NTKIlcMudmZtdLZmuVXbOiHLD7CdHlBFdvkaGLI'
    )
    expect(row.className).toContain('break-all')
    expect(screen.getByLabelText('Edit todo').parentElement?.className).toContain('shrink-0')
  })

  it('opens the edit dialog for a completed todo and saves through the store', async () => {
    render(<TodosPanel />)
    fireEvent.click(screen.getByLabelText('Edit todo'))
    expect(screen.getByText('Edit Task')).toBeTruthy()
    expect(screen.getByLabelText('Title')).toHaveProperty('value', 'Done task')
    fireEvent.click(screen.getByText('Save'))
    await act(async () => {})
    expect(storeState.saveTodo).toHaveBeenCalledWith(
      expect.objectContaining({ repoId: 'repo-a', id: 'todo-1', title: 'Done task' })
    )
  })

  it('deletes a completed todo after the two-click confirm', async () => {
    render(<TodosPanel />)
    fireEvent.click(screen.getByLabelText('Delete todo'))
    expect(storeState.removeTodo).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Confirm delete'))
    await act(async () => {})
    expect(storeState.removeTodo).toHaveBeenCalledWith({ repoId: 'repo-a', todoId: 'todo-1' })
  })

  it('unchecks a completed todo back to not-done', async () => {
    render(<TodosPanel />)
    fireEvent.click(screen.getByLabelText('Mark as not done'))
    await act(async () => {})
    expect(storeState.toggleTodo).toHaveBeenCalledWith({
      repoId: 'repo-a',
      todoId: 'todo-1',
      done: false
    })
  })
})
