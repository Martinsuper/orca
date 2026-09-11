import { powerMonitor } from 'electron'
import type { Todo } from '../../../shared/types'
import type { NotificationDispatchRequest } from '../../../shared/notification-settings-types'
import type { Store } from './store'

const SCHEDULER_LOG_PREFIX = '[todo-reminder-scheduler]'
const MAX_TIMER_DELAY_MS = 2 ** 31 - 1
const MIN_DELAY_MS = 1000

export type ReminderDispatchFn = (request: NotificationDispatchRequest) => void

type SchedulerDeps = {
  store: Store
  dispatch: ReminderDispatchFn
  now?: () => number
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
  onResume?: () => void
  onSuspend?: () => void
}

type ScheduledReminder = {
  todo: Todo
  fireAt: number
}

function defaultNow(): number {
  return Date.now()
}

function collectAllTodos(store: Store): Todo[] {
  const todos: Todo[] = []
  for (const repo of store.getRepos()) {
    todos.push(...store.getTodos(repo.id))
  }
  todos.push(...store.getGlobalTodos())
  return todos
}

function isReminderEligible(todo: Todo): boolean {
  if (todo.done) {
    return false
  }
  if (!todo.reminderAt || todo.reminderAt <= 0) {
    return false
  }
  if (todo.reminderDeliveredAt && todo.reminderDeliveredAt >= todo.reminderAt) {
    return false
  }
  return true
}

function findNextReminder(todos: readonly Todo[]): ScheduledReminder | null {
  let next: ScheduledReminder | null = null
  for (const todo of todos) {
    if (!isReminderEligible(todo)) {
      continue
    }
    if (!next || todo.reminderAt! < next.fireAt) {
      next = { todo, fireAt: todo.reminderAt! }
    }
  }
  return next
}

export class TodoReminderScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly deps: Required<Omit<SchedulerDeps, 'onResume' | 'onSuspend'>>
  private readonly onResume?: () => void
  private readonly onSuspend?: () => void
  private disposed = false
  private readonly unsubscribePower: (() => void) | null = null

  constructor(deps: SchedulerDeps) {
    this.deps = {
      store: deps.store,
      dispatch: deps.dispatch,
      now: deps.now ?? defaultNow,
      setTimeout: deps.setTimeout ?? setTimeout,
      clearTimeout: deps.clearTimeout ?? clearTimeout
    }
    this.onResume = deps.onResume
    this.onSuspend = deps.onSuspend

    const onResumeListener = (): void => {
      this.onResume?.()
      this.reconcile()
    }
    const onSuspendListener = (): void => {
      this.onSuspend?.()
    }
    powerMonitor.on('resume', onResumeListener)
    powerMonitor.on('suspend', onSuspendListener)
    this.unsubscribePower = (): void => {
      powerMonitor.off('resume', onResumeListener)
      powerMonitor.off('suspend', onSuspendListener)
    }
  }

  hydrate(): void {
    if (this.disposed) {
      return
    }
    this.reconcile()
  }

  reconcile(): void {
    if (this.disposed) {
      return
    }
    this.clearTimer()
    const now = this.deps.now()
    const todos = collectAllTodos(this.deps.store)
    const next = findNextReminder(todos)
    if (!next) {
      return
    }
    const delay = Math.max(MIN_DELAY_MS, next.fireAt - now)
    const clampedDelay = Math.min(delay, MAX_TIMER_DELAY_MS)
    this.timer = this.deps.setTimeout(() => {
      this.fireReminder(next.todo)
    }, clampedDelay)
  }

  private fireReminder(todo: Todo): void {
    if (this.disposed) {
      return
    }
    const now = this.deps.now()
    const current = this.findTodoById(todo.id, todo.repoId)
    if (!current || current.done) {
      this.reconcile()
      return
    }
    if (current.reminderDeliveredAt && current.reminderDeliveredAt >= current.reminderAt!) {
      this.reconcile()
      return
    }
    try {
      const request: NotificationDispatchRequest = {
        source: 'todo-reminder',
        notificationId: `todo-reminder:${current.id}`,
        worktreeLabel: current.repoId || 'global',
        agentLastAssistantMessage: current.title
      }
      this.deps.dispatch(request)
    } catch (error) {
      console.warn(SCHEDULER_LOG_PREFIX, 'Failed to dispatch reminder:', error)
    }
    this.markDelivered(current, now)
    this.reconcile()
  }

  private findTodoById(todoId: string, repoId: string): Todo | null {
    if (repoId === '') {
      return this.deps.store.getGlobalTodos().find((t) => t.id === todoId) ?? null
    }
    if (!this.deps.store.getRepos().some((r) => r.id === repoId)) {
      return null
    }
    return this.deps.store.getTodos(repoId).find((t) => t.id === todoId) ?? null
  }

  private markDelivered(todo: Todo, deliveredAt: number): void {
    try {
      if (todo.repoId === '') {
        const existing = this.deps.store.getGlobalTodos().find((t) => t.id === todo.id)
        if (existing) {
          this.deps.store.saveGlobalTodo({
            ...existing,
            reminderDeliveredAt: deliveredAt
          })
        }
      } else {
        const existing = this.deps.store.getTodos(todo.repoId).find((t) => t.id === todo.id)
        if (existing) {
          this.deps.store.saveTodo({
            ...existing,
            reminderDeliveredAt: deliveredAt
          })
        }
      }
    } catch (error) {
      console.warn(SCHEDULER_LOG_PREFIX, 'Failed to mark reminder delivered:', error)
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.deps.clearTimeout(this.timer)
      this.timer = null
    }
  }

  dispose(): void {
    this.disposed = true
    this.clearTimer()
    this.unsubscribePower?.()
  }
}
