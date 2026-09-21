import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from '../../../shared/types'
import type { NotificationDispatchRequest } from '../../../shared/notification-settings-types'
import { TodoReminderScheduler, type TodoReminderStore } from './todo-reminder-scheduler'

vi.mock('electron', () => ({
  powerMonitor: {
    on: vi.fn(),
    off: vi.fn()
  }
}))

class MockStore implements TodoReminderStore {
  readonly getRepos = vi.fn(() => Object.keys(this.todosByRepo).map((id) => ({ id })))
  readonly getTodos = vi.fn((repoId: string) => this.todosByRepo[repoId] ?? [])
  readonly getGlobalTodos = vi.fn(() => this.globalTodos)
  readonly saveTodo = vi.fn((todo: Todo): Todo => {
    this.todosByRepo[todo.repoId] = this.replaceTodo(this.todosByRepo[todo.repoId] ?? [], todo)
    return todo
  })
  readonly saveGlobalTodo = vi.fn((todo: Todo): Todo => {
    this.globalTodos = this.replaceTodo(this.globalTodos, todo)
    return todo
  })

  constructor(
    private todosByRepo: Record<string, Todo[]> = {},
    private globalTodos: Todo[] = []
  ) {}

  setGlobalTodos(todos: Todo[]): void {
    this.globalTodos = todos
  }

  private replaceTodo(todos: Todo[], todo: Todo): Todo[] {
    return todos.map((existing) => (existing.id === todo.id ? todo : existing))
  }
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo-1',
    repoId: '',
    title: 'Test task',
    note: '',
    done: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

function createScheduler(
  store: TodoReminderStore,
  dispatch: (request: NotificationDispatchRequest) => void
) {
  return new TodoReminderScheduler({ store, dispatch })
}

describe('TodoReminderScheduler', () => {
  let now: number

  beforeEach(() => {
    now = 100_000
    vi.useFakeTimers()
    vi.setSystemTime(now)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('schedules a timer for the nearest upcoming reminder on hydrate', () => {
    const store = new MockStore({}, [makeTodo({ reminderAt: now + 5000 })])
    const scheduler = createScheduler(store, vi.fn())

    scheduler.hydrate()

    expect(vi.getTimerCount()).toBe(1)
    scheduler.dispose()
  })

  it('does not schedule when no todos have eligible reminders', () => {
    const store = new MockStore({}, [
      makeTodo({ id: 'missing', reminderAt: undefined }),
      makeTodo({ id: 'done', reminderAt: now + 5000, done: true }),
      makeTodo({ id: 'delivered', reminderAt: now + 5000, reminderDeliveredAt: now + 5000 }),
      makeTodo({ id: 'invalid', reminderAt: Number.POSITIVE_INFINITY })
    ])
    const scheduler = createScheduler(store, vi.fn())

    scheduler.hydrate()

    expect(vi.getTimerCount()).toBe(0)
    scheduler.dispose()
  })

  it('picks the nearest reminder among global and per-repo todos', () => {
    const store = new MockStore(
      { 'repo-1': [makeTodo({ id: 'repo', repoId: 'repo-1', reminderAt: now + 3000 })] },
      [makeTodo({ id: 'global', reminderAt: now + 10_000 })]
    )
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    vi.advanceTimersByTime(3000)

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'todo-reminder',
        notificationId: 'todo-reminder:repo'
      })
    )
    scheduler.dispose()
  })

  it('does not fire a long-delay reminder when the timer delay is clamped', () => {
    const reminderAt = now + 2 ** 31
    const store = new MockStore({}, [makeTodo({ reminderAt })])
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    vi.advanceTimersByTime(2 ** 31 - 1)

    expect(dispatch).not.toHaveBeenCalled()
    expect(store.saveGlobalTodo).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not dispatch when the reminder was cleared before its timer fires', () => {
    const todo = makeTodo({ reminderAt: now + 5000 })
    const store = new MockStore({}, [todo])
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    store.setGlobalTodos([{ ...todo, reminderAt: undefined }])
    vi.advanceTimersByTime(5000)

    expect(dispatch).not.toHaveBeenCalled()
    expect(store.saveGlobalTodo).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not dispatch when the reminder was moved later before its timer fires', () => {
    const todo = makeTodo({ reminderAt: now + 5000 })
    const store = new MockStore({}, [todo])
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    store.setGlobalTodos([{ ...todo, reminderAt: now + 10_000 }])
    vi.advanceTimersByTime(5000)

    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(5000)
    expect(dispatch).toHaveBeenCalledTimes(1)
    scheduler.dispose()
  })

  it('dispatches once when the clock reaches the current reminder due time', () => {
    const todo = makeTodo({ id: 'fire-test', reminderAt: now + 5000, title: 'Do thing' })
    const store = new MockStore({}, [todo])
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    vi.advanceTimersByTime(4999)
    expect(dispatch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'todo-reminder',
        notificationId: 'todo-reminder:fire-test',
        agentLastAssistantMessage: 'Do thing'
      })
    )
    expect(store.saveGlobalTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'fire-test',
        reminderDeliveredAt: now + 5000
      })
    )

    vi.advanceTimersByTime(60_000)
    expect(dispatch).toHaveBeenCalledTimes(1)
    scheduler.dispose()
  })

  it('does not dispatch if the todo was completed before the timer fires', () => {
    const todo = makeTodo({ reminderAt: now + 5000 })
    const store = new MockStore({}, [todo])
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    store.setGlobalTodos([{ ...todo, done: true, completedAt: now }])
    vi.advanceTimersByTime(5000)

    expect(dispatch).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not dispatch if the todo was deleted before the timer fires', () => {
    const store = new MockStore({}, [makeTodo({ reminderAt: now + 5000 })])
    const dispatch = vi.fn()
    const scheduler = createScheduler(store, dispatch)

    scheduler.hydrate()
    store.setGlobalTodos([])
    vi.advanceTimersByTime(5000)

    expect(dispatch).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('reschedules after reconcile and does not schedule after disposal', () => {
    const todo = makeTodo({ reminderAt: now + 50_000 })
    const store = new MockStore({}, [todo])
    const scheduler = createScheduler(store, vi.fn())

    scheduler.hydrate()
    store.setGlobalTodos([{ ...todo, reminderAt: now + 2000 }])
    scheduler.reconcile()
    vi.advanceTimersByTime(2000)
    scheduler.dispose()
    scheduler.reconcile()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('marks delivered per-repo todos via saveTodo', () => {
    const todo = makeTodo({ id: 'repo-deliver', repoId: 'repo-1', reminderAt: now + 5000 })
    const store = new MockStore({ 'repo-1': [todo] })
    const scheduler = createScheduler(store, vi.fn())

    scheduler.hydrate()
    vi.advanceTimersByTime(5000)

    expect(store.saveTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'repo-deliver',
        reminderDeliveredAt: now + 5000
      })
    )
    expect(store.saveGlobalTodo).not.toHaveBeenCalled()
    scheduler.dispose()
  })
})
