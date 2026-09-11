import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Todo } from '../../../shared/types'
import type { NotificationDispatchRequest } from '../../../shared/notification-settings-types'
import { TodoReminderScheduler } from './todo-reminder-scheduler'

vi.mock('electron', () => ({
  powerMonitor: {
    on: vi.fn(),
    off: vi.fn()
  }
}))

type MockStore = {
  getRepos: ReturnType<typeof vi.fn>
  getTodos: ReturnType<typeof vi.fn>
  getGlobalTodos: ReturnType<typeof vi.fn>
  saveTodo: ReturnType<typeof vi.fn>
  saveGlobalTodo: ReturnType<typeof vi.fn>
}

function makeStore(todosByRepo: Record<string, Todo[]> = {}, globalTodos: Todo[] = []): MockStore {
  const repoIds = Object.keys(todosByRepo)
  return {
    getRepos: vi.fn(() => repoIds.map((id) => ({ id }))),
    getTodos: vi.fn((repoId: string) => todosByRepo[repoId] ?? []),
    getGlobalTodos: vi.fn(() => globalTodos),
    saveTodo: vi.fn(),
    saveGlobalTodo: vi.fn()
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
  store: MockStore,
  now: number,
  dispatch: (req: NotificationDispatchRequest) => void
) {
  const timers: { fn: () => void; delay: number }[] = []
  const setTimeoutMock = vi.fn((fn: () => void, delay: number) => {
    const handle = { fn, delay }
    timers.push(handle)
    return handle as unknown as ReturnType<typeof setTimeout>
  })
  const clearTimeoutMock = vi.fn((handle: ReturnType<typeof setTimeout>) => {
    const idx = timers.indexOf(handle as unknown as { fn: () => void; delay: number })
    if (idx !== -1) {
      timers.splice(idx, 1)
    }
  })
  const scheduler = new TodoReminderScheduler({
    store: store as never,
    dispatch,
    now: () => now,
    setTimeout: setTimeoutMock as never,
    clearTimeout: clearTimeoutMock as never
  })
  return { scheduler, timers, setTimeoutMock, clearTimeoutMock }
}

function fireTimer(timers: { fn: () => void; delay: number }[]): void {
  if (timers.length > 0) {
    timers[0].fn()
  }
}

describe('TodoReminderScheduler', () => {
  let now: number

  beforeEach(() => {
    now = 100_000
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('schedules a timer for the nearest upcoming reminder on hydrate', () => {
    const todo = makeTodo({ reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    expect(timers).toHaveLength(1)
    scheduler.dispose()
  })

  it('does not schedule when no todos have reminders', () => {
    const todo = makeTodo({ reminderAt: undefined })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(setTimeoutMock).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not schedule for done todos', () => {
    const todo = makeTodo({ reminderAt: now + 5000, done: true })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(setTimeoutMock).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not schedule for already-delivered reminders', () => {
    const todo = makeTodo({
      reminderAt: now + 5000,
      reminderDeliveredAt: now + 5000
    })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(setTimeoutMock).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('picks the nearest reminder among multiple todos', () => {
    const t1 = makeTodo({ id: 't1', reminderAt: now + 10_000 })
    const t2 = makeTodo({ id: 't2', reminderAt: now + 3_000 })
    const t3 = makeTodo({ id: 't3', reminderAt: now + 50_000 })
    const store = makeStore({}, [t1, t2, t3])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBeLessThanOrEqual(3_000)
    scheduler.dispose()
  })

  it('includes per-repo todos', () => {
    const todo = makeTodo({ id: 'repo-todo', repoId: 'repo-1', reminderAt: now + 5000 })
    const store = makeStore({ 'repo-1': [todo] }, [])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(timers).toHaveLength(1)
    scheduler.dispose()
  })

  it('dispatches a notification when the timer fires', () => {
    const todo = makeTodo({ id: 'fire-test', reminderAt: now + 5000, title: 'Do thing' })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    fireTimer(timers)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'todo-reminder',
        notificationId: 'todo-reminder:fire-test',
        agentLastAssistantMessage: 'Do thing'
      })
    )
    scheduler.dispose()
  })

  it('marks reminderDeliveredAt after firing to prevent duplicates', () => {
    const todo = makeTodo({ id: 'dedup-test', reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    fireTimer(timers)
    expect(store.saveGlobalTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'dedup-test',
        reminderDeliveredAt: now
      })
    )
    scheduler.dispose()
  })

  it('does not dispatch if todo was completed before timer fires', () => {
    const todo = makeTodo({ id: 'done-test', reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    // Simulate the todo being completed before the timer fires
    store.getGlobalTodos.mockReturnValue([{ ...todo, done: true, completedAt: now }])
    fireTimer(timers)
    expect(dispatch).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not dispatch if todo was deleted before timer fires', () => {
    const todo = makeTodo({ id: 'deleted-test', reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    store.getGlobalTodos.mockReturnValue([])
    fireTimer(timers)
    expect(dispatch).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not dispatch if reminder was already delivered before timer fires', () => {
    const todo = makeTodo({ id: 'already-delivered', reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    store.getGlobalTodos.mockReturnValue([{ ...todo, reminderDeliveredAt: now + 5000 }])
    fireTimer(timers)
    expect(dispatch).not.toHaveBeenCalled()
    scheduler.dispose()
  })

  it('reschedules after firing to pick up the next reminder', () => {
    const t1 = makeTodo({ id: 't1', reminderAt: now + 5000 })
    const t2 = makeTodo({ id: 't2', reminderAt: now + 15_000 })
    const store = makeStore({}, [t1, t2])
    const dispatch = vi.fn()
    const { scheduler, timers, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(setTimeoutMock).toHaveBeenCalledTimes(1)
    fireTimer(timers)
    // After firing, reconcile should have scheduled the next timer
    expect(setTimeoutMock).toHaveBeenCalledTimes(2)
    scheduler.dispose()
  })

  it('cancels and reschedules on reconcile after mutation', () => {
    const todo = makeTodo({ id: 'mutate-test', reminderAt: now + 50_000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, clearTimeoutMock, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(setTimeoutMock).toHaveBeenCalledTimes(1)

    // Simulate a mutation that changes the reminder to sooner
    store.getGlobalTodos.mockReturnValue([{ ...todo, reminderAt: now + 2_000 }])
    scheduler.reconcile()
    expect(clearTimeoutMock).toHaveBeenCalled()
    expect(setTimeoutMock).toHaveBeenCalledTimes(2)
    scheduler.dispose()
  })

  it('cancels timer on reconcile when no eligible reminders remain', () => {
    const todo = makeTodo({ id: 'cancel-test', reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, clearTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    // Simulate the todo being removed
    store.getGlobalTodos.mockReturnValue([])
    scheduler.reconcile()
    expect(clearTimeoutMock).toHaveBeenCalled()
    scheduler.dispose()
  })

  it('does not schedule after dispose', () => {
    const todo = makeTodo({ id: 'disposed-test', reminderAt: now + 5000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, setTimeoutMock } = createScheduler(store, now, dispatch)

    scheduler.dispose()
    scheduler.reconcile()
    expect(setTimeoutMock).not.toHaveBeenCalled()
  })

  it('uses min delay of 1s even if reminder is in the past', () => {
    const todo = makeTodo({ id: 'past-test', reminderAt: now - 1000 })
    const store = makeStore({}, [todo])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    expect(timers).toHaveLength(1)
    expect(timers[0].delay).toBeGreaterThanOrEqual(1000)
    scheduler.dispose()
  })

  it('marks delivered for per-repo todos via saveTodo', () => {
    const todo = makeTodo({
      id: 'repo-deliver',
      repoId: 'repo-1',
      reminderAt: now + 5000
    })
    const store = makeStore({ 'repo-1': [todo] }, [])
    const dispatch = vi.fn()
    const { scheduler, timers } = createScheduler(store, now, dispatch)

    scheduler.hydrate()
    fireTimer(timers)
    expect(store.saveTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'repo-deliver',
        reminderDeliveredAt: now
      })
    )
    expect(store.saveGlobalTodo).not.toHaveBeenCalled()
    scheduler.dispose()
  })
})
