import { describe, expect, it } from 'vitest'
import { todoNavEquals, type TodoNavItem } from './todo-nav-types'

describe('todoNavEquals', () => {
  it('returns true for identical smart-view items', () => {
    const a: TodoNavItem = { kind: 'smart-view', view: 'important' }
    const b: TodoNavItem = { kind: 'smart-view', view: 'important' }
    expect(todoNavEquals(a, b)).toBe(true)
  })

  it('returns false for different smart-view values', () => {
    const a: TodoNavItem = { kind: 'smart-view', view: 'important' }
    const b: TodoNavItem = { kind: 'smart-view', view: 'all' }
    expect(todoNavEquals(a, b)).toBe(false)
  })

  it('returns true for identical list items', () => {
    const a: TodoNavItem = { kind: 'list', listId: 'list-1' }
    const b: TodoNavItem = { kind: 'list', listId: 'list-1' }
    expect(todoNavEquals(a, b)).toBe(true)
  })

  it('returns false for different list ids', () => {
    const a: TodoNavItem = { kind: 'list', listId: 'list-1' }
    const b: TodoNavItem = { kind: 'list', listId: 'list-2' }
    expect(todoNavEquals(a, b)).toBe(false)
  })

  it('returns false when kinds differ', () => {
    const a: TodoNavItem = { kind: 'smart-view', view: 'all' }
    const b: TodoNavItem = { kind: 'list', listId: 'all' }
    expect(todoNavEquals(a, b)).toBe(false)
  })

  it('handles undefined values', () => {
    expect(todoNavEquals(undefined, undefined)).toBe(true)
    expect(todoNavEquals(undefined, { kind: 'smart-view', view: 'all' })).toBe(false)
  })
})
