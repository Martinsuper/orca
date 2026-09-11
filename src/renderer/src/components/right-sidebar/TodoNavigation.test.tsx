// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

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
  onCreateList: vi.fn(),
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

  it('calls onCreateList when new list name is submitted', () => {
    const onCreateList = vi.fn()
    render(<TodoNavigation {...defaultProps} onCreateList={onCreateList} />)
    fireEvent.click(screen.getByText('New list'))
    const input = screen.getByPlaceholderText('List name')
    fireEvent.change(input, { target: { value: 'New Project' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreateList).toHaveBeenCalledWith('New Project')
  })
})
