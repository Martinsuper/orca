import { describe, expect, it } from 'vitest'
import type { Todo } from '../../../../shared/types'
import {
  compareTodosForView,
  filterByList,
  filterBySmartView,
  isOverdue
} from './todo-view-filters'

function makeTodo(overrides: Partial<Todo> & { id: string }): Todo {
  return {
    repoId: '',
    title: overrides.id,
    note: '',
    done: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('isOverdue', () => {
  it('returns false when no dueDate', () => {
    expect(isOverdue(undefined, false)).toBe(false)
  })

  it('returns false when done', () => {
    const today = new Date()
    const past = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate() - 1).padStart(2, '0')}`
    expect(isOverdue(past, true)).toBe(false)
  })

  it('returns true when dueDate is in the past and not done', () => {
    const today = new Date()
    const past = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(Math.max(1, today.getDate() - 1)).padStart(2, '0')}`
    expect(isOverdue(past, false)).toBe(true)
  })

  it('returns false when dueDate is today', () => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(isOverdue(todayStr, false)).toBe(false)
  })
})

describe('compareTodosForView', () => {
  it('sorts overdue before non-overdue', () => {
    const today = new Date()
    const past = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(Math.max(1, today.getDate() - 1)).padStart(2, '0')}`
    const future = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate() + 7).padStart(2, '0')}`

    const overdue = makeTodo({ id: 'overdue', dueDate: past })
    const normal = makeTodo({ id: 'normal', dueDate: future })

    expect(compareTodosForView(overdue, normal)).toBe(-1)
    expect(compareTodosForView(normal, overdue)).toBe(1)
  })

  it('sorts earlier dueDate before later', () => {
    const a = makeTodo({ id: 'a', dueDate: '2026-01-01', updatedAt: 5 })
    const b = makeTodo({ id: 'b', dueDate: '2026-02-01', updatedAt: 10 })
    expect(compareTodosForView(a, b)).toBe(-1)
  })

  it('sorts with-due-date before no-due-date', () => {
    const withDate = makeTodo({ id: 'a', dueDate: '2026-01-01' })
    const noDate = makeTodo({ id: 'b' })
    expect(compareTodosForView(withDate, noDate)).toBe(-1)
    expect(compareTodosForView(noDate, withDate)).toBe(1)
  })

  it('falls back to updatedAt desc when no dates', () => {
    const older = makeTodo({ id: 'a', updatedAt: 1 })
    const newer = makeTodo({ id: 'b', updatedAt: 10 })
    expect(compareTodosForView(older, newer)).toBe(9)
    expect(compareTodosForView(newer, older)).toBe(-9)
  })
})

describe('filterBySmartView', () => {
  it('separates important, planned, all, completed', () => {
    const todos: Todo[] = [
      makeTodo({ id: 't1', important: true, dueDate: '2026-01-01' }),
      makeTodo({ id: 't2', done: true, important: true }),
      makeTodo({ id: 't3', dueDate: '2026-02-01' }),
      makeTodo({ id: 't4' })
    ]

    const result = filterBySmartView(todos)

    expect(result.important.map((t) => t.id)).toEqual(['t1'])
    expect(result.planned.map((t) => t.id)).toEqual(['t1', 't3'])
    expect(result.all.map((t) => t.id)).toEqual(['t1', 't3', 't4'])
    expect(result.completed.map((t) => t.id)).toEqual(['t2'])
  })

  it('returns empty arrays for empty input', () => {
    const result = filterBySmartView([])
    expect(result.important).toEqual([])
    expect(result.planned).toEqual([])
    expect(result.all).toEqual([])
    expect(result.completed).toEqual([])
  })
})

describe('filterByList', () => {
  it('filters incomplete todos by listId', () => {
    const todos: Todo[] = [
      makeTodo({ id: 't1', listId: 'list-a', done: false }),
      makeTodo({ id: 't2', listId: 'list-b', done: false }),
      makeTodo({ id: 't3', listId: 'list-a', done: true }),
      makeTodo({ id: 't4', listId: undefined, done: false })
    ]

    const result = filterByList(todos, 'list-a')
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })

  it('matches todos with undefined listId when filtering for empty string', () => {
    const todos: Todo[] = [
      makeTodo({ id: 't1', listId: undefined }),
      makeTodo({ id: 't2', listId: 'list-a' })
    ]
    const result = filterByList(todos, '')
    expect(result.map((t) => t.id)).toEqual(['t1'])
  })
})
