import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo, TodoList } from '../../../../shared/types'
import { omitTodosForRepos } from './todos-repo-pruning'
import {
  createTestStore,
  deferred,
  makeList,
  makeTodo,
  mockApi,
  resetTodoApiMocks
} from './todos-test-harness'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('createTodosSlice sync', () => {
  beforeEach(() => {
    resetTodoApiMocks()
  })

  it('ignores a stale project todo response after invalidation', async () => {
    const store = createTestStore()
    const stale = deferred<Todo[]>()
    const fresh = deferred<Todo[]>()
    mockApi.todos.list.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise)

    const initialLoad = store.getState().fetchTodos('repo-1')
    store.getState().invalidateTodos('repo-1')
    stale.resolve([makeTodo({ id: 'stale', repoId: 'repo-1' })])
    await initialLoad

    expect(store.getState().todosByRepo['repo-1']).toBeUndefined()
    fresh.resolve([makeTodo({ id: 'fresh', repoId: 'repo-1' })])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().todosByRepo['repo-1'].map((todo) => todo.id)).toEqual(['fresh'])
  })

  it('ignores a stale global todo response after invalidation', async () => {
    const store = createTestStore()
    const stale = deferred<Todo[]>()
    const fresh = deferred<Todo[]>()
    mockApi.todos.listGlobal.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise)

    const initialLoad = store.getState().fetchGlobalTodos()
    store.getState().invalidateGlobalTodos()
    stale.resolve([makeTodo({ id: 'stale', repoId: '' })])
    await initialLoad

    expect(store.getState().globalTodos).toBeUndefined()
    fresh.resolve([makeTodo({ id: 'fresh', repoId: '' })])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().globalTodos?.map((todo) => todo.id)).toEqual(['fresh'])
  })

  it('ignores a stale project list response after invalidation', async () => {
    const store = createTestStore()
    const stale = deferred<TodoList[]>()
    const fresh = deferred<TodoList[]>()
    mockApi.todos.listLists.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise)

    const initialLoad = store.getState().fetchTodoLists('repo-1')
    store.getState().invalidateTodoLists('repo-1')
    stale.resolve([makeList({ id: 'stale', repoId: 'repo-1' })])
    await initialLoad

    expect(store.getState().todoListsByRepo['repo-1']).toBeUndefined()
    fresh.resolve([makeList({ id: 'fresh', repoId: 'repo-1' })])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().todoListsByRepo['repo-1'].map((list) => list.id)).toEqual(['fresh'])
  })

  it('does not restore a removed repo from an in-flight response', async () => {
    const store = createTestStore()
    const pending = deferred<Todo[]>()
    mockApi.todos.list.mockReturnValueOnce(pending.promise)

    const load = store.getState().fetchTodos('repo-1')
    store.setState((state) => omitTodosForRepos(state, ['repo-1']))
    pending.resolve([makeTodo({ id: 'late', repoId: 'repo-1' })])
    await load

    expect(store.getState().todosByRepo['repo-1']).toBeUndefined()
  })

  it('rejects old requests after the same repo is removed and loaded again', async () => {
    const store = createTestStore()
    const old = deferred<Todo[]>()
    const fresh = deferred<Todo[]>()
    mockApi.todos.list.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise)
    const oldLoad = store.getState().fetchTodos('repo-1')
    store.setState((state) => omitTodosForRepos(state, ['repo-1']))
    const newLoad = store.getState().fetchTodos('repo-1')
    old.resolve([makeTodo({ id: 'old', repoId: 'repo-1' })])
    await oldLoad
    expect(store.getState().todosByRepo['repo-1']).toBeUndefined()
    fresh.resolve([makeTodo({ id: 'new', repoId: 'repo-1' })])
    await newLoad
    expect(store.getState().todosByRepo['repo-1'].map((todo) => todo.id)).toEqual(['new'])
  })

  it.each(['global-remove', 'global-toggle', 'global-list-remove', 'project-list-remove'] as const)(
    'does not overwrite newer data when an older %s fails',
    async (operation) => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'task', repoId: '' })
      const list = makeList({ id: 'list', repoId: '' })
      const projectList = makeList({ id: 'list', repoId: 'repo-1' })
      store.setState({
        globalTodos: [todo],
        globalTodoLists: [list],
        todoListsByRepo: { 'repo-1': [projectList] }
      })
      const failure = deferred<Todo | void>()
      mockApi.todos.removeGlobal.mockReturnValueOnce(failure.promise)
      mockApi.todos.toggleGlobal.mockReturnValueOnce(failure.promise)
      mockApi.todos.removeGlobalList.mockReturnValueOnce(failure.promise)
      mockApi.todos.removeList.mockReturnValueOnce(failure.promise)
      const state = store.getState()
      const mutation =
        operation === 'global-remove'
          ? state.removeGlobalTodo({ todoId: 'task' })
          : operation === 'global-toggle'
            ? state.toggleGlobalTodo({ todoId: 'task', done: true })
            : operation === 'global-list-remove'
              ? state.removeGlobalTodoList({ listId: 'list' })
              : state.removeTodoList({ repoId: 'repo-1', listId: 'list' })
      const settled = mutation.catch(() => undefined)
      const freshTodo = { ...todo, title: 'Newer task' }
      const freshList = { ...list, title: 'Newer list' }
      const freshProjectList = { ...projectList, title: 'Newer project list' }
      mockApi.todos.listGlobal.mockResolvedValueOnce([freshTodo])
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([freshList])
      mockApi.todos.listLists.mockResolvedValueOnce([freshProjectList])
      await Promise.all([
        state.fetchGlobalTodos({ force: true }),
        state.fetchGlobalTodoLists({ force: true }),
        state.fetchTodoLists('repo-1', { force: true })
      ])
      failure.reject(new Error('Older mutation failed'))
      await settled
      expect(store.getState().globalTodos).toEqual([freshTodo])
      expect(store.getState().globalTodoLists).toEqual([freshList])
      expect(store.getState().todoListsByRepo['repo-1']).toEqual([freshProjectList])
    }
  )

  it('does not recreate a removed repo when list deletion fails', async () => {
    const store = createTestStore()
    store.setState({
      todoListsByRepo: { 'repo-1': [makeList({ id: 'list', repoId: 'repo-1' })] }
    })
    const failure = deferred<void>()
    mockApi.todos.removeList.mockReturnValueOnce(failure.promise)
    const pending = store.getState().removeTodoList({ repoId: 'repo-1', listId: 'list' })
    store.setState((state) => omitTodosForRepos(state, ['repo-1']))
    failure.reject(new Error('Removed project'))
    await pending
    expect(store.getState().todoListsByRepo['repo-1']).toBeUndefined()
    expect(store.getState().todosByRepo['repo-1']).toBeUndefined()
  })

  it('restarts an invalidated load when a save settles after its notification', async () => {
    const store = createTestStore()
    const existing = makeTodo({ id: 'existing', repoId: 'repo-1' })
    const saved = makeTodo({ id: 'saved', repoId: 'repo-1' })
    mockApi.todos.list.mockResolvedValueOnce([existing])
    await store.getState().fetchTodos('repo-1')
    const save = deferred<Todo>()
    const notificationRefresh = deferred<Todo[]>()
    const settledRefresh = deferred<Todo[]>()
    mockApi.todos.save.mockReturnValueOnce(save.promise)
    mockApi.todos.list
      .mockReturnValueOnce(notificationRefresh.promise)
      .mockReturnValueOnce(settledRefresh.promise)

    const savePromise = store.getState().saveTodo({ repoId: 'repo-1', id: 'saved', title: 'Saved' })
    store.getState().invalidateTodos('repo-1')
    save.resolve(saved)
    await savePromise
    notificationRefresh.resolve([existing])
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(store.getState().todosLoadStatusByRepo['repo-1']).toBe('loaded')
    expect(store.getState().todosLoadingByRepo['repo-1']).toBe(true)
    settledRefresh.resolve([existing, saved])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().todosByRepo['repo-1'].map((todo) => todo.id)).toEqual([
      'existing',
      'saved'
    ])
  })

  it('restarts global task and list saves after notification refreshes', async () => {
    const store = createTestStore()
    const globalTodo = makeTodo({ id: 'global', repoId: '' })
    const savedTodo = makeTodo({ id: 'saved', repoId: '' })
    mockApi.todos.listGlobal.mockResolvedValueOnce([globalTodo])
    await store.getState().fetchGlobalTodos()
    const saveTodo = deferred<Todo>()
    const staleTodos = deferred<Todo[]>()
    const freshTodos = deferred<Todo[]>()
    mockApi.todos.saveGlobal.mockReturnValueOnce(saveTodo.promise)
    mockApi.todos.listGlobal
      .mockReturnValueOnce(staleTodos.promise)
      .mockReturnValueOnce(freshTodos.promise)
    const todoSave = store.getState().saveGlobalTodo({ id: 'saved', title: 'Saved' })
    store.getState().invalidateGlobalTodos()
    saveTodo.resolve(savedTodo)
    await todoSave
    staleTodos.resolve([globalTodo])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().globalTodosLoading).toBe(true)
    freshTodos.resolve([globalTodo, savedTodo])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().globalTodos?.map((todo) => todo.id)).toEqual(['global', 'saved'])

    const projectList = makeList({ id: 'default', repoId: 'repo-1' })
    const savedProjectList = makeList({ id: 'project-new', repoId: 'repo-1' })
    mockApi.todos.listLists.mockResolvedValueOnce([projectList])
    await store.getState().fetchTodoLists('repo-1')
    const saveProjectList = deferred<TodoList>()
    const staleProjectLists = deferred<TodoList[]>()
    const freshProjectLists = deferred<TodoList[]>()
    mockApi.todos.saveList.mockReturnValueOnce(saveProjectList.promise)
    mockApi.todos.listLists
      .mockReturnValueOnce(staleProjectLists.promise)
      .mockReturnValueOnce(freshProjectLists.promise)
    const projectListSave = store.getState().saveTodoList({ repoId: 'repo-1', title: 'New' })
    store.getState().invalidateTodoLists('repo-1')
    saveProjectList.resolve(savedProjectList)
    await projectListSave
    staleProjectLists.resolve([projectList])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().todoListsLoadingByRepo['repo-1']).toBe(true)
    freshProjectLists.resolve([projectList, savedProjectList])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().todoListsByRepo['repo-1'].map((list) => list.id)).toEqual([
      'default',
      'project-new'
    ])

    const globalList = makeList({ id: 'global-default', repoId: '' })
    const savedGlobalList = makeList({ id: 'global-new', repoId: '' })
    mockApi.todos.listGlobalLists.mockResolvedValueOnce([globalList])
    await store.getState().fetchGlobalTodoLists()
    const saveGlobalList = deferred<TodoList>()
    const staleGlobalLists = deferred<TodoList[]>()
    const freshGlobalLists = deferred<TodoList[]>()
    mockApi.todos.saveGlobalList.mockReturnValueOnce(saveGlobalList.promise)
    mockApi.todos.listGlobalLists
      .mockReturnValueOnce(staleGlobalLists.promise)
      .mockReturnValueOnce(freshGlobalLists.promise)
    const globalListSave = store.getState().saveGlobalTodoList({ title: 'New' })
    store.getState().invalidateGlobalTodoLists()
    saveGlobalList.resolve(savedGlobalList)
    await globalListSave
    staleGlobalLists.resolve([globalList])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().globalTodoListsLoading).toBe(true)
    freshGlobalLists.resolve([globalList, savedGlobalList])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.getState().globalTodoLists?.map((list) => list.id)).toEqual([
      'global-default',
      'global-new'
    ])
  })

  it('commits only the latest forced request when responses arrive in reverse order', async () => {
    const store = createTestStore()
    const first = deferred<Todo[]>()
    const second = deferred<Todo[]>()
    mockApi.todos.list.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const firstLoad = store.getState().fetchTodos('repo-1', { force: true })
    const secondLoad = store.getState().fetchTodos('repo-1', { force: true })
    second.resolve([makeTodo({ id: 'second', repoId: 'repo-1' })])
    await secondLoad
    first.resolve([makeTodo({ id: 'first', repoId: 'repo-1' })])
    await firstLoad

    expect(store.getState().todosByRepo['repo-1'].map((todo) => todo.id)).toEqual(['second'])
  })

  it('does not resurrect a repo removed while toggle and list save are pending', async () => {
    const store = createTestStore()
    const todo = makeTodo({ id: 'todo-1', repoId: 'repo-1' })
    const list = makeList({ id: 'default', repoId: 'repo-1' })
    mockApi.todos.list.mockResolvedValueOnce([todo])
    mockApi.todos.listLists.mockResolvedValueOnce([list])
    await store.getState().fetchTodos('repo-1')
    await store.getState().fetchTodoLists('repo-1')
    const toggle = deferred<Todo>()
    const saveList = deferred<TodoList>()
    mockApi.todos.toggle.mockReturnValueOnce(toggle.promise)
    mockApi.todos.saveList.mockReturnValueOnce(saveList.promise)

    const togglePromise = store
      .getState()
      .toggleTodo({ repoId: 'repo-1', todoId: 'todo-1', done: true })
    const saveListPromise = store.getState().saveTodoList({ repoId: 'repo-1', title: 'New list' })
    store.setState((state) => omitTodosForRepos(state, ['repo-1']))
    toggle.resolve({ ...todo, done: true })
    saveList.resolve(makeList({ id: 'new', repoId: 'repo-1' }))
    await Promise.all([togglePromise, saveListPromise])

    expect(store.getState().todosByRepo['repo-1']).toBeUndefined()
    expect(store.getState().todoListsByRepo['repo-1']).toBeUndefined()
  })
})
