// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

vi.mock('@/i18n/i18n', () => ({
  translate: vi.fn((_key: string, fallback: string) => fallback)
}))

import { translate } from '@/i18n/i18n'
import { displayTodoListTitle } from './todo-list-display'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('displayTodoListTitle', () => {
  it('localizes the seeded default list title', () => {
    const title = displayTodoListTitle({
      id: 'default',
      repoId: 'repo-a',
      title: 'Tasks',
      createdAt: 1,
      updatedAt: 1
    })
    expect(translate).toHaveBeenCalledWith(
      'auto.components.right.sidebar.TodoNavigation.defaultList',
      'Tasks'
    )
    expect(title).toBe('Tasks')
  })

  it('keeps a renamed default list title as-is', () => {
    const title = displayTodoListTitle({
      id: 'default',
      repoId: 'repo-a',
      title: 'My tasks',
      createdAt: 1,
      updatedAt: 1
    })
    expect(translate).not.toHaveBeenCalled()
    expect(title).toBe('My tasks')
  })

  it('keeps custom list titles as-is', () => {
    const title = displayTodoListTitle({
      id: 'list-1',
      repoId: 'repo-a',
      title: 'Shopping',
      createdAt: 1,
      updatedAt: 1
    })
    expect(translate).not.toHaveBeenCalled()
    expect(title).toBe('Shopping')
  })
})
