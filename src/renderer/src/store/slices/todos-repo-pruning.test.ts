import { describe, expect, it } from 'vitest'
import type { Todo, TodoList } from '../../../../shared/types'
import { omitTodosForRepos } from './todos-repo-pruning'

type TodosState = Parameters<typeof omitTodosForRepos>[0]

function makeState(overrides: Partial<TodosState>): TodosState {
  return {
    todosByRepo: {},
    todosLoadingByRepo: {},
    todosLoadStatusByRepo: {},
    todosErrorByRepo: {},
    todosRequestGenerationByRepo: {},
    todoListsByRepo: {},
    todoListsLoadingByRepo: {},
    todoListsRequestGenerationByRepo: {},
    todoNavigationByScope: {},
    ...overrides
  }
}

function makeTodo(id: string, repoId: string): Todo {
  return {
    id,
    repoId,
    title: id,
    note: '',
    done: false,
    createdAt: 1,
    updatedAt: 1,
    listId: 'default',
    important: false,
    steps: []
  }
}

function makeList(id: string, repoId: string): TodoList {
  return { id, repoId, title: id, createdAt: 1, updatedAt: 1 }
}

describe('omitTodosForRepos', () => {
  it('returns empty when no repos removed', () => {
    const state = makeState({})
    const result = omitTodosForRepos(state, [])
    expect(result).toEqual({})
  })

  it('removes todosByRepo entries for removed repos', () => {
    const state = makeState({
      todosByRepo: {
        'repo-1': [makeTodo('t1', 'repo-1')],
        'repo-2': [makeTodo('t2', 'repo-2')]
      }
    })
    const result = omitTodosForRepos(state, ['repo-1'])
    expect(result.todosByRepo).toEqual({ 'repo-2': [makeTodo('t2', 'repo-2')] })
  })

  it('removes loading/status/error maps for removed repos', () => {
    const state = makeState({
      todosByRepo: { 'repo-1': [], 'repo-2': [] },
      todosLoadingByRepo: { 'repo-1': true, 'repo-2': false },
      todosLoadStatusByRepo: { 'repo-1': 'loading', 'repo-2': 'loaded' },
      todosErrorByRepo: { 'repo-1': 'err', 'repo-2': undefined }
    })
    const result = omitTodosForRepos(state, ['repo-1'])
    expect(result.todosLoadingByRepo).toEqual({ 'repo-2': false })
    expect(result.todosLoadStatusByRepo).toEqual({ 'repo-2': 'loaded' })
    expect(result.todosErrorByRepo).toEqual({ 'repo-2': undefined })
  })

  it('removes todoListsByRepo and todoListsLoadingByRepo for removed repos', () => {
    const state = makeState({
      todoListsByRepo: {
        'repo-1': [makeList('l1', 'repo-1')],
        'repo-2': [makeList('l2', 'repo-2')]
      },
      todoListsLoadingByRepo: { 'repo-1': true, 'repo-2': false }
    })
    const result = omitTodosForRepos(state, ['repo-1'])
    expect(result.todoListsByRepo).toEqual({ 'repo-2': [makeList('l2', 'repo-2')] })
    expect(result.todoListsLoadingByRepo).toEqual({ 'repo-2': false })
  })

  it('removes request generations and project navigation for removed repos', () => {
    const state = makeState({
      todosRequestGenerationByRepo: { 'repo-1': 3, 'repo-2': 1 },
      todoListsRequestGenerationByRepo: { 'repo-1': 2, 'repo-2': 1 },
      todoNavigationByScope: {
        'project:repo-1': { kind: 'list', listId: 'list-1' },
        'project:repo-2': { kind: 'smart-view', view: 'all' },
        global: { kind: 'smart-view', view: 'all' }
      }
    })

    const result = omitTodosForRepos(state, ['repo-1'])

    expect(result.todosRequestGenerationByRepo).toEqual({ 'repo-1': 4, 'repo-2': 1 })
    expect(result.todoListsRequestGenerationByRepo).toEqual({ 'repo-1': 3, 'repo-2': 1 })
    expect(result.todoNavigationByScope).toEqual({
      'project:repo-2': { kind: 'smart-view', view: 'all' },
      global: { kind: 'smart-view', view: 'all' }
    })
  })

  it('does not mutate the original state', () => {
    const state = makeState({
      todosByRepo: { 'repo-1': [makeTodo('t1', 'repo-1')] },
      todoListsByRepo: { 'repo-1': [makeList('l1', 'repo-1')] }
    })
    omitTodosForRepos(state, ['repo-1'])
    expect(state.todosByRepo).toHaveProperty('repo-1')
    expect(state.todoListsByRepo).toHaveProperty('repo-1')
  })
})
