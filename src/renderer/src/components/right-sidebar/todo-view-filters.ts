import type { Todo } from '../../../../shared/types'

function todayLocalDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function isOverdue(dueDate: string | undefined, done: boolean): boolean {
  if (!dueDate || done) {
    return false
  }
  return dueDate < todayLocalDate()
}

export function compareTodosForView(left: Todo, right: Todo): number {
  const leftOverdue = isOverdue(left.dueDate, left.done)
  const rightOverdue = isOverdue(right.dueDate, right.done)
  if (leftOverdue !== rightOverdue) {
    return leftOverdue ? -1 : 1
  }
  if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
    return left.dueDate < right.dueDate ? -1 : 1
  }
  if (left.dueDate && !right.dueDate) {
    return -1
  }
  if (!left.dueDate && right.dueDate) {
    return 1
  }
  return right.updatedAt - left.updatedAt
}

export type SmartViewFilterResult = {
  important: Todo[]
  planned: Todo[]
  all: Todo[]
  completed: Todo[]
}

export function filterBySmartView(todos: Todo[]): SmartViewFilterResult {
  return {
    important: todos.filter((t) => !t.done && t.important).sort(compareTodosForView),
    planned: todos.filter((t) => !t.done && t.dueDate).sort(compareTodosForView),
    all: todos.filter((t) => !t.done).sort(compareTodosForView),
    completed: todos.filter((t) => t.done).sort(compareTodosForView)
  }
}

export function filterByList(todos: Todo[], listId: string): Todo[] {
  return todos.filter((t) => !t.done && (t.listId ?? '') === listId).sort(compareTodosForView)
}
