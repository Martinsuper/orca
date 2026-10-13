// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/i18n/i18n', () => ({
  translate: vi.fn((_key: string, fallback: string) => fallback)
}))

import { translate } from '@/i18n/i18n'
import { TodoNavigation } from './TodoNavigation'
import type { TodoList } from '../../../../shared/types'

const lists: TodoList[] = [
  { id: 'list-1', repoId: '', title: 'Shopping', createdAt: 1, updatedAt: 1 },
  { id: 'list-2', repoId: '', title: 'Work', createdAt: 2, updatedAt: 2 }
]

const defaultProps = {
  lists,
  activeNav: undefined,
  onNavChange: vi.fn(),
  onCreateList: vi.fn(async () => true),
  onRenameList: vi.fn(),
  onDeleteList: vi.fn()
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TodoNavigation', () => {
  it('renders all five smart view buttons', () => {
    render(<TodoNavigation {...defaultProps} />)
    expect(screen.getByText('My Day')).toBeTruthy()
    expect(screen.getByText('Important')).toBeTruthy()
    expect(screen.getByText('Planned')).toBeTruthy()
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()
  })

  it('renders custom list entries', () => {
    render(<TodoNavigation {...defaultProps} />)
    expect(screen.getByText('Shopping')).toBeTruthy()
    expect(screen.getByText('Work')).toBeTruthy()
  })

  it('calls onNavChange with smart-view when a smart view button is clicked', () => {
    const onNavChange = vi.fn()
    render(<TodoNavigation {...defaultProps} onNavChange={onNavChange} />)
    fireEvent.click(screen.getByText('My Day'))
    expect(onNavChange).toHaveBeenCalledWith({
      kind: 'smart-view',
      view: 'my-day'
    })
  })

  it('calls onNavChange with list item when a list is clicked', () => {
    const onNavChange = vi.fn()
    render(<TodoNavigation {...defaultProps} onNavChange={onNavChange} />)
    fireEvent.click(screen.getByText('Shopping'))
    expect(onNavChange).toHaveBeenCalledWith({
      kind: 'list',
      listId: 'list-1'
    })
  })

  it('renders a "New list" button', () => {
    render(<TodoNavigation {...defaultProps} />)
    expect(screen.getByText('New list')).toBeTruthy()
  })

  it('shows input when New list is clicked', () => {
    render(<TodoNavigation {...defaultProps} />)
    fireEvent.click(screen.getByText('New list'))
    expect(screen.getByPlaceholderText('List name')).toBeTruthy()
  })

  it('calls onCreateList when new list name is submitted', async () => {
    const onCreateList = vi.fn(async () => true)
    render(<TodoNavigation {...defaultProps} onCreateList={onCreateList} />)
    fireEvent.click(screen.getByText('New list'))
    const input = screen.getByPlaceholderText('List name')
    fireEvent.change(input, { target: { value: 'New Project' } })
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }))
    expect(onCreateList).toHaveBeenCalledWith('New Project')
    expect(screen.queryByPlaceholderText('List name')).toBeNull()
  })

  it('retains the title after a failed save and supports retry with the create button', async () => {
    const onCreateList = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<TodoNavigation {...defaultProps} onCreateList={onCreateList} />)
    fireEvent.click(screen.getByText('New list'))
    const input = screen.getByPlaceholderText('List name')
    fireEvent.change(input, { target: { value: 'Project' } })
    await act(async () => fireEvent.keyDown(input, { key: 'Enter' }))
    expect(screen.getByDisplayValue('Project')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'New list' })))
    expect(onCreateList).toHaveBeenCalledTimes(2)
    expect(screen.queryByPlaceholderText('List name')).toBeNull()
  })

  it('submits only once while a save is pending', async () => {
    let finishSave: (saved: boolean) => void = () => {}
    const onCreateList = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve
        })
    )
    render(<TodoNavigation {...defaultProps} onCreateList={onCreateList} />)
    fireEvent.click(screen.getByText('New list'))
    const input = screen.getByPlaceholderText('List name')
    fireEvent.change(input, { target: { value: 'Project' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.blur(input)
    expect(onCreateList).toHaveBeenCalledTimes(1)
    expect(input.hasAttribute('disabled')).toBe(true)
    await act(async () => finishSave(true))
  })

  it('does not submit while confirming IME composition', () => {
    const onCreateList = vi.fn(async () => true)
    render(<TodoNavigation {...defaultProps} onCreateList={onCreateList} />)
    fireEvent.click(screen.getByText('New list'))
    const input = screen.getByPlaceholderText('List name')
    fireEvent.change(input, { target: { value: '任务列表' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onCreateList).not.toHaveBeenCalled()
  })

  it('disables creation when the scope has no project', () => {
    render(<TodoNavigation {...defaultProps} canCreateList={false} />)
    fireEvent.click(screen.getByText('New list'))
    expect(screen.queryByPlaceholderText('List name')).toBeNull()
    expect(screen.getByRole('button', { name: 'New list' }).hasAttribute('disabled')).toBe(true)
  })

  it('collapses the create input when blurred with an empty title', () => {
    const onCreateList = vi.fn(async () => true)
    render(<TodoNavigation {...defaultProps} onCreateList={onCreateList} />)
    fireEvent.click(screen.getByText('New list'))
    const input = screen.getByPlaceholderText('List name')
    fireEvent.blur(input)
    expect(screen.queryByPlaceholderText('List name')).toBeNull()
    expect(onCreateList).not.toHaveBeenCalled()
  })

  it('cancels renaming when blurred with an empty title', () => {
    const onRenameList = vi.fn()
    render(<TodoNavigation {...defaultProps} onRenameList={onRenameList} />)
    fireEvent.click(screen.getAllByLabelText('Rename list')[0])
    const input = screen.getByDisplayValue('Shopping')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(onRenameList).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('   ')).toBeNull()
    expect(screen.getByText('Shopping')).toBeTruthy()
  })

  it('does not submit a rename while confirming IME composition', () => {
    const onRenameList = vi.fn()
    render(<TodoNavigation {...defaultProps} onRenameList={onRenameList} />)
    fireEvent.click(screen.getAllByLabelText('Rename list')[0])
    const input = screen.getByDisplayValue('Shopping')
    fireEvent.change(input, { target: { value: '购物' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(onRenameList).not.toHaveBeenCalled()
  })

  it('localizes the seeded default list title but keeps a renamed one', () => {
    const { unmount } = render(
      <TodoNavigation
        {...defaultProps}
        lists={[{ id: 'default', repoId: '', title: 'Tasks', createdAt: 1, updatedAt: 1 }]}
      />
    )
    expect(screen.getByText('Tasks')).toBeTruthy()
    expect(translate).toHaveBeenCalledWith(
      'auto.components.right.sidebar.TodoNavigation.defaultList',
      'Tasks'
    )
    unmount()

    render(
      <TodoNavigation
        {...defaultProps}
        lists={[{ id: 'default', repoId: '', title: 'Renamed', createdAt: 1, updatedAt: 1 }]}
      />
    )
    expect(screen.getByText('Renamed')).toBeTruthy()
  })

  it('requires a second click to delete a list', () => {
    const onDeleteList = vi.fn()
    render(<TodoNavigation {...defaultProps} onDeleteList={onDeleteList} />)
    const deleteButton = screen.getAllByLabelText('Delete list')[0]
    fireEvent.click(deleteButton)
    expect(onDeleteList).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Confirm delete'))
    expect(onDeleteList).toHaveBeenCalledWith('list-1')
  })
})
