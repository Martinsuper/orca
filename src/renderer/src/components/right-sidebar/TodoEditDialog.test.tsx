// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

import { TodoEditDialog } from './TodoEditDialog'

const lists = [{ id: 'default', repoId: '', title: 'Tasks', createdAt: 1, updatedAt: 1 }]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TodoEditDialog', () => {
  it('emits null for cleared optional values without resetting unsaved fields on a list refresh', () => {
    const onSave = vi.fn()
    const initial = {
      title: 'Original title',
      dueDate: '2026-09-21',
      reminderAt: new Date('2026-09-21T12:00').getTime(),
      myDayDate: '2026-09-20'
    }
    const view = render(
      <TodoEditDialog
        open
        initial={initial}
        lists={lists}
        canChangeList
        onClose={vi.fn()}
        onSave={onSave}
      />
    )

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved title' } })
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Reminder'), { target: { value: '' } })
    fireEvent.click(screen.getByLabelText('Add to My Day'))
    view.rerender(
      <TodoEditDialog
        open
        initial={initial}
        lists={[...lists, { id: 'later', repoId: '', title: 'Later', createdAt: 2, updatedAt: 2 }]}
        canChangeList
        onClose={vi.fn()}
        onSave={onSave}
      />
    )

    expect(screen.getByLabelText('Title').getAttribute('value')).toBe('Unsaved title')
    fireEvent.click(screen.getByText('Save'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Unsaved title',
        dueDate: null,
        reminderAt: null,
        myDayDate: null
      })
    )
  })
})
