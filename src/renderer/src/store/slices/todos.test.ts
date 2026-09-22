import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from '../../../../shared/types'
import { getMyDayTodos } from './todos'
import { createTodoInvalidationSubscriptions } from '../../app-shell/todo-invalidation-subscriptions'
import {
  createTestStore,
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

describe('createTodosSlice', () => {
  beforeEach(() => {
    resetTodoApiMocks()
  })

  describe('per-repo todos', () => {
    it('fetches todos into the requested repo bucket', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'todo-1', repoId: 'repo-1', title: 'Fix bug' })
      mockApi.todos.list.mockResolvedValueOnce([todo])

      await store.getState().fetchTodos('repo-1')

      expect(mockApi.todos.list).toHaveBeenCalledWith({ repoId: 'repo-1' })
      expect(store.getState().todosByRepo).toEqual({ 'repo-1': [todo] })
      expect(store.getState().todosLoadingByRepo['repo-1']).toBe(false)
      expect(store.getState().todosLoadStatusByRepo['repo-1']).toBe('loaded')
      expect(store.getState().todosErrorByRepo['repo-1']).toBeUndefined()
    })

    it('skips fetch when already loaded', async () => {
      const store = createTestStore()
      mockApi.todos.list.mockResolvedValueOnce([])

      await store.getState().fetchTodos('repo-1')
      await store.getState().fetchTodos('repo-1')

      expect(mockApi.todos.list).toHaveBeenCalledTimes(1)
    })

    it('skips fetch when already loading', async () => {
      const store = createTestStore()
      let resolveList: (todos: Todo[]) => void = () => {}
      mockApi.todos.list.mockReturnValueOnce(
        new Promise<Todo[]>((resolve) => {
          resolveList = resolve
        })
      )

      const fetchPromise = store.getState().fetchTodos('repo-1')
      await store.getState().fetchTodos('repo-1')

      expect(mockApi.todos.list).toHaveBeenCalledTimes(1)

      resolveList([])
      await fetchPromise
    })

    it('records error on fetch failure', async () => {
      const store = createTestStore()
      mockApi.todos.list.mockRejectedValueOnce(new Error('disk failed'))

      await store.getState().fetchTodos('repo-1')

      expect(store.getState().todosByRepo['repo-1']).toBeUndefined()
      expect(store.getState().todosLoadingByRepo['repo-1']).toBe(false)
      expect(store.getState().todosLoadStatusByRepo['repo-1']).toBe('error')
      expect(store.getState().todosErrorByRepo['repo-1']).toBe('disk failed')
    })

    it('saves a new todo and appends to list', async () => {
      const store = createTestStore()
      const existing = makeTodo({ id: 'todo-1', repoId: 'repo-1', title: 'Existing' })
      mockApi.todos.list.mockResolvedValueOnce([existing])
      await store.getState().fetchTodos('repo-1')

      const saved = makeTodo({ id: 'todo-2', repoId: 'repo-1', title: 'New', updatedAt: 2 })
      mockApi.todos.save.mockResolvedValueOnce(saved)
      mockApi.todos.list.mockResolvedValueOnce([existing, saved])

      const result = await store.getState().saveTodo({ repoId: 'repo-1', title: 'New' })

      expect(result).toEqual(saved)
      expect(store.getState().todosByRepo['repo-1']).toHaveLength(2)
    })

    it('saves a todo with extended fields', async () => {
      const store = createTestStore()
      await store.getState().fetchTodos('repo-1')

      const saved = makeTodo({
        id: 'todo-x',
        repoId: 'repo-1',
        title: 'Extended',
        important: true,
        dueDate: '2026-01-01',
        myDayDate: '2026-01-01',
        steps: [{ id: 's1', title: 'Step 1', done: false, updatedAt: 1 }]
      })
      mockApi.todos.save.mockResolvedValueOnce(saved)

      const result = await store.getState().saveTodo({
        repoId: 'repo-1',
        title: 'Extended',
        important: true,
        dueDate: '2026-01-01',
        myDayDate: '2026-01-01',
        steps: [{ id: 's1', title: 'Step 1', done: false, updatedAt: 1 }]
      })

      expect(result).toEqual(saved)
      expect(mockApi.todos.save).toHaveBeenCalledWith(
        expect.objectContaining({
          important: true,
          dueDate: '2026-01-01',
          myDayDate: '2026-01-01'
        })
      )
    })

    it('removes a todo optimistically and rolls back on failure', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'todo-1', repoId: 'repo-1', title: 'Remove me' })
      mockApi.todos.list.mockResolvedValueOnce([todo])
      await store.getState().fetchTodos('repo-1')

      mockApi.todos.remove.mockRejectedValueOnce(new Error('disk failed'))
      mockApi.todos.list.mockResolvedValueOnce([todo])

      await expect(
        store.getState().removeTodo({ repoId: 'repo-1', todoId: 'todo-1' })
      ).rejects.toThrow('disk failed')

      expect(store.getState().todosByRepo['repo-1']).toHaveLength(1)
    })

    it('toggles todo done state optimistically and corrects with server response', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'todo-1', repoId: 'repo-1', title: 'Toggle me', done: false })
      mockApi.todos.list.mockResolvedValueOnce([todo])
      await store.getState().fetchTodos('repo-1')

      const toggled = { ...todo, done: true, completedAt: 5, updatedAt: 5 }
      mockApi.todos.toggle.mockResolvedValueOnce(toggled)
      mockApi.todos.list.mockResolvedValueOnce([toggled])

      await store.getState().toggleTodo({ repoId: 'repo-1', todoId: 'todo-1', done: true })

      expect(store.getState().todosByRepo['repo-1'][0].done).toBe(true)
      expect(store.getState().todosByRepo['repo-1'][0].updatedAt).toBe(5)
    })

    it('rolls back toggle on failure', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'todo-1', repoId: 'repo-1', title: 'Toggle me', done: false })
      mockApi.todos.list.mockResolvedValueOnce([todo])
      await store.getState().fetchTodos('repo-1')

      mockApi.todos.toggle.mockRejectedValueOnce(new Error('disk failed'))
      mockApi.todos.list.mockResolvedValueOnce([todo])

      await store.getState().toggleTodo({ repoId: 'repo-1', todoId: 'todo-1', done: true })

      expect(store.getState().todosByRepo['repo-1'][0].done).toBe(false)
    })
  })

  describe('per-repo todo lists', () => {
    it('fetches todo lists', async () => {
      const store = createTestStore()
      const list = makeList({ id: 'default', repoId: 'repo-1', title: 'Tasks' })
      mockApi.todos.listLists.mockResolvedValueOnce([list])

      await store.getState().fetchTodoLists('repo-1')

      expect(store.getState().todoListsByRepo['repo-1']).toEqual([list])
    })

    it('skips fetch when already loaded', async () => {
      const store = createTestStore()
      mockApi.todos.listLists.mockResolvedValueOnce([])

      await store.getState().fetchTodoLists('repo-1')
      await store.getState().fetchTodoLists('repo-1')

      expect(mockApi.todos.listLists).toHaveBeenCalledTimes(1)
    })

    it('creates a new list', async () => {
      const store = createTestStore()
      const existing = makeList({ id: 'default', repoId: 'repo-1', title: 'Tasks' })
      mockApi.todos.listLists.mockResolvedValueOnce([existing])
      await store.getState().fetchTodoLists('repo-1')

      const created = makeList({ id: 'list-2', repoId: 'repo-1', title: 'Shopping', updatedAt: 2 })
      mockApi.todos.saveList.mockResolvedValueOnce(created)
      mockApi.todos.listLists.mockResolvedValueOnce([existing, created])

      const result = await store.getState().saveTodoList({ repoId: 'repo-1', title: 'Shopping' })

      expect(result).toEqual(created)
      expect(store.getState().todoListsByRepo['repo-1']).toHaveLength(2)
    })

    it('removes a list', async () => {
      const store = createTestStore()
      const list = makeList({ id: 'list-x', repoId: 'repo-1', title: 'To Delete' })
      mockApi.todos.listLists.mockResolvedValueOnce([
        makeList({ id: 'default', repoId: 'repo-1', title: 'Tasks' }),
        list
      ])
      await store.getState().fetchTodoLists('repo-1')

      mockApi.todos.list.mockResolvedValueOnce([])
      await store.getState().fetchTodos('repo-1')
      mockApi.todos.removeList.mockResolvedValueOnce(undefined)
      mockApi.todos.list.mockResolvedValueOnce([])
      mockApi.todos.listLists.mockResolvedValueOnce([
        makeList({ id: 'default', repoId: 'repo-1', title: 'Tasks' })
      ])

      await store.getState().removeTodoList({ repoId: 'repo-1', listId: 'list-x' })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(store.getState().todoListsByRepo['repo-1']).toHaveLength(1)
      expect(mockApi.todos.list).toHaveBeenCalledTimes(2)
      expect(mockApi.todos.listLists).toHaveBeenCalledTimes(2)
    })
  })

  describe('global todos', () => {
    it('fetches global todos', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'g-1', repoId: '', title: 'Global task' })
      mockApi.todos.listGlobal.mockResolvedValueOnce([todo])

      await store.getState().fetchGlobalTodos()

      expect(store.getState().globalTodos).toEqual([todo])
      expect(store.getState().globalTodosLoadStatus).toBe('loaded')
    })

    it('saves a new global todo', async () => {
      const store = createTestStore()
      mockApi.todos.listGlobal.mockResolvedValueOnce([])
      await store.getState().fetchGlobalTodos()

      const saved = makeTodo({ id: 'g-2', repoId: '', title: 'New global', updatedAt: 2 })
      mockApi.todos.saveGlobal.mockResolvedValueOnce(saved)
      mockApi.todos.listGlobal.mockResolvedValueOnce([saved])

      const result = await store.getState().saveGlobalTodo({ title: 'New global' })

      expect(result).toEqual(saved)
      expect(store.getState().globalTodos).toHaveLength(1)
    })

    it('removes a global todo optimistically and rolls back on failure', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'g-1', repoId: '', title: 'Remove me' })
      mockApi.todos.listGlobal.mockResolvedValueOnce([todo])
      await store.getState().fetchGlobalTodos()

      mockApi.todos.removeGlobal.mockRejectedValueOnce(new Error('disk failed'))
      mockApi.todos.listGlobal.mockResolvedValueOnce([todo])

      await expect(store.getState().removeGlobalTodo({ todoId: 'g-1' })).rejects.toThrow(
        'disk failed'
      )

      expect(store.getState().globalTodos).toHaveLength(1)
    })

    it('toggles global todo done state', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 'g-1', repoId: '', title: 'Toggle me', done: false })
      mockApi.todos.listGlobal.mockResolvedValueOnce([todo])
      await store.getState().fetchGlobalTodos()

      const toggled = { ...todo, done: true, updatedAt: 5 }
      mockApi.todos.toggleGlobal.mockResolvedValueOnce(toggled)
      mockApi.todos.listGlobal.mockResolvedValueOnce([toggled])

      await store.getState().toggleGlobalTodo({ todoId: 'g-1', done: true })

      expect(store.getState().globalTodos![0].done).toBe(true)
      expect(store.getState().globalTodos![0].updatedAt).toBe(5)
    })
  })

  describe('global todo lists', () => {
    it('fetches global todo lists', async () => {
      const store = createTestStore()
      const list = makeList({ id: 'default', repoId: '', title: 'Tasks' })
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([list])

      await store.getState().fetchGlobalTodoLists()

      expect(store.getState().globalTodoLists).toEqual([list])
    })

    it('creates a new global list', async () => {
      const store = createTestStore()
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([
        makeList({ id: 'default', repoId: '', title: 'Tasks' })
      ])
      await store.getState().fetchGlobalTodoLists()

      const created = makeList({ id: 'gl-2', repoId: '', title: 'Personal', updatedAt: 2 })
      mockApi.todos.saveGlobalList.mockResolvedValueOnce(created)
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([
        makeList({ id: 'default', repoId: '', title: 'Tasks' }),
        created
      ])

      const result = await store.getState().saveGlobalTodoList({ title: 'Personal' })

      expect(result).toEqual(created)
      expect(store.getState().globalTodoLists).toHaveLength(2)
    })

    it('removes a global list', async () => {
      const store = createTestStore()
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([
        makeList({ id: 'default', repoId: '', title: 'Tasks' }),
        makeList({ id: 'gl-x', repoId: '', title: 'Temp' })
      ])
      await store.getState().fetchGlobalTodoLists()

      mockApi.todos.listGlobal.mockResolvedValueOnce([])
      await store.getState().fetchGlobalTodos()
      mockApi.todos.removeGlobalList.mockResolvedValueOnce(undefined)
      mockApi.todos.listGlobal.mockResolvedValueOnce([])
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([
        makeList({ id: 'default', repoId: '', title: 'Tasks' })
      ])

      await store.getState().removeGlobalTodoList({ listId: 'gl-x' })
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(store.getState().globalTodoLists).toHaveLength(1)
      expect(mockApi.todos.listGlobal).toHaveBeenCalledTimes(2)
      expect(mockApi.todos.listGlobalLists).toHaveBeenCalledTimes(2)
    })
  })

  describe('My Day aggregator', () => {
    it('collects todos with myDayDate matching local date from global and repo scopes', () => {
      const today = '2026-09-10'
      const globalTodo = makeTodo({
        id: 'g-1',
        repoId: '',
        title: 'Global my day',
        myDayDate: today
      })
      const repoTodo = makeTodo({
        id: 'r-1',
        repoId: 'repo-1',
        title: 'Repo my day',
        myDayDate: today
      })
      const otherDay = makeTodo({
        id: 'r-2',
        repoId: 'repo-1',
        title: 'Other day',
        myDayDate: '2026-09-09'
      })
      const doneMyDay = makeTodo({
        id: 'r-3',
        repoId: 'repo-1',
        title: 'Done my day',
        myDayDate: today,
        done: true
      })

      const result = getMyDayTodos(
        { 'repo-1': [repoTodo, otherDay, doneMyDay] },
        [globalTodo],
        today
      )

      expect(result).toHaveLength(2)
      expect(result.map((t) => t.id)).toEqual(['g-1', 'r-1'])
    })

    it('returns empty when no todos match', () => {
      expect(getMyDayTodos(undefined, undefined, '2026-09-10')).toEqual([])
    })
  })

  describe('invalidate', () => {
    it('invalidates and re-fetches repo todos', async () => {
      const store = createTestStore()
      const todo = makeTodo({ id: 't1', repoId: 'repo-1', title: 'T1' })
      mockApi.todos.list.mockResolvedValueOnce([todo])
      await store.getState().fetchTodos('repo-1')

      const refreshed = makeTodo({ id: 't2', repoId: 'repo-1', title: 'T2' })
      mockApi.todos.list.mockResolvedValueOnce([refreshed])

      getMyDayTodos(store.getState().todosByRepo, store.getState().globalTodos, '2026-09-10')

      store.getState().invalidateTodos('repo-1')
      await new Promise((r) => setTimeout(r, 0))

      expect(mockApi.todos.list).toHaveBeenCalledTimes(2)
      expect(store.getState().todosByRepo['repo-1']).toEqual([refreshed])
    })

    it('invalidates global todos', async () => {
      const store = createTestStore()
      mockApi.todos.listGlobal.mockResolvedValueOnce([])
      await store.getState().fetchGlobalTodos()

      const todo = makeTodo({ id: 'g1', repoId: '', title: 'G1' })
      mockApi.todos.listGlobal.mockResolvedValueOnce([todo])

      store.getState().invalidateGlobalTodos()
      await new Promise((r) => setTimeout(r, 0))

      expect(store.getState().globalTodos).toEqual([todo])
    })

    it('invalidates repo todo lists', async () => {
      const store = createTestStore()
      mockApi.todos.listLists.mockResolvedValueOnce([])
      await store.getState().fetchTodoLists('repo-1')

      const list = makeList({ id: 'l1', repoId: 'repo-1', title: 'L1' })
      mockApi.todos.listLists.mockResolvedValueOnce([list])

      store.getState().invalidateTodoLists('repo-1')
      await new Promise((r) => setTimeout(r, 0))

      expect(store.getState().todoListsByRepo['repo-1']).toEqual([list])
    })

    it('invalidates global todo lists', async () => {
      const store = createTestStore()
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([])
      await store.getState().fetchGlobalTodoLists()

      const list = makeList({ id: 'gl1', repoId: '', title: 'GL1' })
      mockApi.todos.listGlobalLists.mockResolvedValueOnce([list])

      store.getState().invalidateGlobalTodoLists()
      await new Promise((r) => setTimeout(r, 0))

      expect(store.getState().globalTodoLists).toEqual([list])
    })
  })

  describe('todo invalidation subscriptions', () => {
    it('routes all events and unsubscribes them during cleanup', () => {
      const callbacks: Record<string, ((data?: { repoId: string }) => void) | undefined> = {}
      const unsubscribes = [vi.fn(), vi.fn(), vi.fn(), vi.fn()]
      const api = {
        onChanged: vi.fn((callback) => {
          callbacks.changed = callback
          return unsubscribes[0]
        }),
        onListsChanged: vi.fn((callback) => {
          callbacks.listsChanged = callback
          return unsubscribes[1]
        }),
        onGlobalChanged: vi.fn((callback) => {
          callbacks.globalChanged = callback
          return unsubscribes[2]
        }),
        onGlobalListsChanged: vi.fn((callback) => {
          callbacks.globalListsChanged = callback
          return unsubscribes[3]
        })
      }
      const target = {
        invalidateTodos: vi.fn(),
        invalidateTodoLists: vi.fn(),
        invalidateGlobalTodos: vi.fn(),
        invalidateGlobalTodoLists: vi.fn()
      }

      const cleanup = createTodoInvalidationSubscriptions(api, target)
      callbacks.changed?.({ repoId: 'repo-1' })
      callbacks.listsChanged?.({ repoId: 'repo-1' })
      callbacks.globalChanged?.()
      callbacks.globalListsChanged?.()

      expect(target.invalidateTodos).toHaveBeenCalledWith('repo-1')
      expect(target.invalidateTodoLists).toHaveBeenCalledWith('repo-1')
      expect(target.invalidateGlobalTodos).toHaveBeenCalledOnce()
      expect(target.invalidateGlobalTodoLists).toHaveBeenCalledOnce()

      cleanup()
      expect(unsubscribes).toEqual([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      ])
      for (const unsubscribe of unsubscribes) {
        expect(unsubscribe).toHaveBeenCalledOnce()
      }
    })
  })

  describe('scope', () => {
    it('defaults to project scope', () => {
      const store = createTestStore()
      expect(store.getState().todoScope).toBe('project')
    })

    it('switches scope', () => {
      const store = createTestStore()
      store.getState().setTodoScope('global')
      expect(store.getState().todoScope).toBe('global')
      store.getState().setTodoScope('project')
      expect(store.getState().todoScope).toBe('project')
    })
  })
})
