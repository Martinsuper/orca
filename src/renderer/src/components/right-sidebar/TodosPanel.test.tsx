// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSyncExternalStore } from 'react'
import type { Todo, TodoList } from '../../../../shared/types'

const storeState: Record<string, unknown> = {}
const storeListeners = new Set<() => void>()
let activeRepo: { id: string; displayName: string } | undefined

function setStoreState(next: Record<string, unknown>): void {
  Object.assign(storeState, next)
  for (const listener of storeListeners) {
    listener()
  }
}

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

vi.mock('./TodoNavigation', () => ({
  TodoNavigation: ({
    activeNav,
    onNavChange
  }: {
    activeNav: { kind: string; view?: string; listId?: string } | undefined
    onNavChange: (
      target: { kind: 'smart-view'; view: 'all' | 'my-day' } | { kind: 'list'; listId: string }
    ) => void
  }) => (
    <>
      <div data-testid="active-nav">{activeNav?.view ?? activeNav?.listId}</div>
      <button onClick={() => onNavChange({ kind: 'smart-view', view: 'my-day' })}>My Day</button>
      <button onClick={() => onNavChange({ kind: 'list', listId: 'list-1' })}>List 1</button>
    </>
  )
}))

vi.mock('./TodoItemRow', () => ({
  TodoItemRow: ({
    todo,
    lists,
    onToggle,
    onEdit,
    onRemove
  }: {
    todo: Todo
    lists: TodoList[]
    onToggle: (todo: Todo, done: boolean) => void
    onEdit: (todo: Todo, result: { dueDate: null; reminderAt: null; myDayDate: null }) => void
    onRemove: (todo: Todo) => void
  }) => (
    <div data-testid={`todo-${todo.repoId || 'global'}-${todo.id}`}>
      <span>{todo.title}</span>
      <span>{lists.map((list) => list.title).join(',')}</span>
      <button onClick={() => onToggle(todo, true)}>complete {todo.title}</button>
      <button onClick={() => onEdit(todo, { dueDate: null, reminderAt: null, myDayDate: null })}>
        edit {todo.title}
      </button>
      <button onClick={() => onRemove(todo)}>delete {todo.title}</button>
    </div>
  )
}))

import TodosPanel from './TodosPanel'

const defaultList: TodoList = {
  id: 'default',
  repoId: '',
  title: 'Tasks',
  createdAt: 1,
  updatedAt: 1
}

function todayLocalDate(): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: 'todo-1',
    repoId: '',
    title: 'Todo',
    note: '',
    done: false,
    createdAt: 1,
    updatedAt: 1,
    listId: 'default',
    ...overrides
  }
}

function resetStore(): void {
  activeRepo = { id: 'repo-a', displayName: 'Repo A' }
  Object.assign(storeState, {
    repos: [activeRepo],
    todoScope: 'project',
    todoNavigationByScope: { 'project:repo-a': { kind: 'smart-view', view: 'all' } },
    todosByRepo: { 'repo-a': [] },
    todosLoadStatusByRepo: { 'repo-a': 'loaded' },
    todosErrorByRepo: {},
    todoListsByRepo: { 'repo-a': [{ ...defaultList, repoId: 'repo-a' }] },
    todoListsLoadingByRepo: {},
    globalTodos: [],
    globalTodosLoadStatus: 'loaded',
    globalTodosError: undefined,
    globalTodoLists: [defaultList],
    globalTodoListsLoading: false,
    fetchTodos: vi.fn(),
    saveTodo: vi.fn(),
    removeTodo: vi.fn(),
    toggleTodo: vi.fn(),
    fetchTodoLists: vi.fn(),
    saveTodoList: vi.fn(),
    removeTodoList: vi.fn(),
    fetchGlobalTodos: vi.fn(),
    saveGlobalTodo: vi.fn(),
    removeGlobalTodo: vi.fn(),
    toggleGlobalTodo: vi.fn(),
    fetchGlobalTodoLists: vi.fn(),
    saveGlobalTodoList: vi.fn(),
    removeGlobalTodoList: vi.fn(),
    setTodoScope: vi.fn(),
    setTodoNavigation: vi.fn()
  })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  for (const key of Object.keys(storeState)) {
    delete storeState[key]
  }
})

describe('TodosPanel', () => {
  it('retains stored navigation across an unmount and remount', () => {
    resetStore()
    storeState.todoNavigationByScope = { 'project:repo-a': { kind: 'list', listId: 'list-1' } }
    storeState.todoListsByRepo = {
      'repo-a': [{ id: 'list-1', repoId: 'repo-a', title: 'List 1', createdAt: 1, updatedAt: 1 }]
    }

    const view = render(<TodosPanel />)
    expect(screen.getByTestId('active-nav').textContent).toBe('list-1')
    view.unmount()
    render(<TodosPanel />)
    expect(screen.getByTestId('active-nav').textContent).toBe('list-1')
  })

  it('keeps a selected list while lists are unavailable and falls back after they load without it', async () => {
    resetStore()
    const setTodoNavigation = vi.fn()
    storeState.todoNavigationByScope = { 'project:repo-a': { kind: 'list', listId: 'list-1' } }
    storeState.todoListsByRepo = {}
    storeState.setTodoNavigation = setTodoNavigation
    const view = render(<TodosPanel />)

    expect(setTodoNavigation).not.toHaveBeenCalled()
    storeState.todoListsByRepo = { 'repo-a': [defaultList] }
    view.rerender(<TodosPanel />)

    await act(async () => {})
    expect(setTodoNavigation).toHaveBeenCalledWith('project:repo-a', {
      kind: 'smart-view',
      view: 'all'
    })
  })

  it('fetches the current repo for a fresh Global My Day and follows repo changes', () => {
    resetStore()
    storeState.todoScope = 'global'
    storeState.todoNavigationByScope = { global: { kind: 'smart-view', view: 'my-day' } }
    storeState.todosByRepo = {}
    storeState.todoListsByRepo = {}

    const view = render(<TodosPanel />)
    expect(storeState.fetchTodos).toHaveBeenCalledWith('repo-a')
    expect(storeState.fetchTodoLists).toHaveBeenCalledWith('repo-a')

    activeRepo = { id: 'repo-b', displayName: 'Repo B' }
    storeState.repos = [activeRepo]
    view.rerender(<TodosPanel />)

    expect(storeState.fetchTodos).toHaveBeenCalledWith('repo-b')
    expect(storeState.fetchTodoLists).toHaveBeenCalledWith('repo-b')
  })

  it('keeps cached rows mounted through a background refresh error', () => {
    resetStore()
    storeState.todoScope = 'global'
    storeState.todoNavigationByScope = { global: { kind: 'smart-view', view: 'all' } }
    storeState.globalTodos = [makeTodo({ title: 'Cached task' })]
    const view = render(<TodosPanel />)

    expect(screen.getByText('Cached task')).toBeTruthy()
    act(() => {
      setStoreState({ globalTodosLoadStatus: 'error', globalTodosError: 'refresh failed' })
    })

    expect(screen.getByText('Cached task')).toBeTruthy()
    expect(screen.getByText('Could not load todos: {{error}}')).toBeTruthy()
    view.unmount()
  })

  it('keeps no-project navigation separate from Global while showing Global My Day tasks', () => {
    resetStore()
    activeRepo = undefined
    storeState.repos = []
    storeState.todoNavigationByScope = {
      global: { kind: 'list', listId: 'global-list' },
      'project:no-repo': { kind: 'smart-view', view: 'my-day' }
    }
    storeState.globalTodos = [makeTodo({ title: 'Global My Day', myDayDate: todayLocalDate() })]

    render(<TodosPanel />)

    expect(screen.getByTestId('active-nav').textContent).toBe('my-day')
    expect(screen.getByText('Global My Day')).toBeTruthy()
  })

  it('routes My Day actions and candidate lists to each todo owner', () => {
    resetStore()
    const localDate = todayLocalDate()
    const globalTodo = makeTodo({ id: 'same-id', title: 'Global task', myDayDate: localDate })
    const projectTodo = makeTodo({
      id: 'same-id',
      repoId: 'repo-a',
      title: 'Project task',
      myDayDate: localDate,
      listId: 'project-list'
    })
    const globalList = { ...defaultList, id: 'global-list', title: 'Global list' }
    const projectList = {
      ...defaultList,
      id: 'project-list',
      repoId: 'repo-a',
      title: 'Project list'
    }
    storeState.todoNavigationByScope = { 'project:repo-a': { kind: 'smart-view', view: 'my-day' } }
    storeState.globalTodos = [globalTodo]
    storeState.todosByRepo = { 'repo-a': [projectTodo] }
    storeState.globalTodoLists = [globalList]
    storeState.todoListsByRepo = { 'repo-a': [projectList] }

    render(<TodosPanel />)

    expect(screen.getByTestId('todo-global-same-id').textContent).toContain('Global list')
    expect(screen.getByTestId('todo-repo-a-same-id').textContent).toContain('Project list')
    fireEvent.click(screen.getByText('complete Global task'))
    fireEvent.click(screen.getByText('complete Project task'))
    fireEvent.click(screen.getByText('edit Global task'))
    fireEvent.click(screen.getByText('edit Project task'))
    fireEvent.click(screen.getByText('delete Global task'))
    fireEvent.click(screen.getByText('delete Project task'))

    expect(storeState.toggleGlobalTodo).toHaveBeenCalledWith({ todoId: 'same-id', done: true })
    expect(storeState.toggleTodo).toHaveBeenCalledWith({
      repoId: 'repo-a',
      todoId: 'same-id',
      done: true
    })
    expect(storeState.saveGlobalTodo).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'same-id', dueDate: null, reminderAt: null, myDayDate: null })
    )
    expect(storeState.saveTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo-a',
        id: 'same-id',
        dueDate: null,
        reminderAt: null,
        myDayDate: null
      })
    )
    expect(storeState.removeGlobalTodo).toHaveBeenCalledWith({ todoId: 'same-id' })
    expect(storeState.removeTodo).toHaveBeenCalledWith({ repoId: 'repo-a', todoId: 'same-id' })
  })
})
