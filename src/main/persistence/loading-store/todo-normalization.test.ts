import { describe, expect, it } from 'vitest'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { Todo, TodoList } from '../../../shared/types'
import { normalizeTodoState, DEFAULT_TODO_LIST_ID, makeDefaultTodoList } from './todo-normalization'

function makeState(overrides: Partial<PersistedState> = {}): PersistedState {
  return {
    schemaVersion: 1,
    repos: [],
    projects: [],
    projectHostSetups: [],
    projectGroups: [],
    folderWorkspaces: [],
    sparsePresetsByRepo: {},
    projectLinksByRepo: {},
    projectLinkFoldersByRepo: {},
    todosByRepo: {},
    retiredWorktreeNamesByRepo: {},
    retiredWorktreeNamesByNamespace: {},
    worktreeMeta: {},
    worktreeLineageById: {},
    workspaceLineageByChildKey: {},
    settings: {} as PersistedState['settings'],
    ui: {} as PersistedState['ui'],
    githubCache: { pr: {}, issue: {} },
    workspaceSession: {} as PersistedState['workspaceSession'],
    workspaceSessionsByHostId: {},
    sshTargets: [],
    deletedSshConfigAliases: [],
    sshRemotePtyLeases: [],
    migrationUnsupportedPtyEntries: [],
    legacyPaneKeyAliasEntries: [],
    automations: [],
    automationRuns: [],
    onboarding: {} as PersistedState['onboarding'],
    ...overrides
  } as PersistedState
}

function makeLegacyTodo(id: string, repoId: string): Todo {
  return { id, repoId, title: id, note: '', done: false, createdAt: 1, updatedAt: 1 }
}

describe('normalizeTodoState', () => {
  it('returns false when state is already normalized', () => {
    const state = makeState()
    const changed = normalizeTodoState(state)
    expect(changed).toBe(true)
  })

  it('creates default list for each repo scope with todos', () => {
    const state = makeState({
      todosByRepo: { 'repo-1': [makeLegacyTodo('t1', 'repo-1')] }
    })
    normalizeTodoState(state)
    expect(state.todoListsByRepo!['repo-1']).toHaveLength(1)
    expect(state.todoListsByRepo!['repo-1'][0].id).toBe(DEFAULT_TODO_LIST_ID)
  })

  it('creates default list for global scope', () => {
    const state = makeState({
      globalTodos: [makeLegacyTodo('g1', '')]
    })
    normalizeTodoState(state)
    expect(state.globalTodoLists).toHaveLength(1)
    expect(state.globalTodoLists![0].id).toBe(DEFAULT_TODO_LIST_ID)
  })

  it('assigns default listId to legacy todos', () => {
    const state = makeState({
      todosByRepo: { 'repo-1': [makeLegacyTodo('t1', 'repo-1')] }
    })
    normalizeTodoState(state)
    expect(state.todosByRepo['repo-1'][0].listId).toBe(DEFAULT_TODO_LIST_ID)
    expect(state.todosByRepo['repo-1'][0].important).toBe(false)
    expect(state.todosByRepo['repo-1'][0].steps).toEqual([])
  })

  it('preserves existing listId and fields on already-normalized todos', () => {
    const existingList: TodoList = {
      id: 'custom-list',
      repoId: 'repo-1',
      title: 'Custom',
      createdAt: 1,
      updatedAt: 1
    }
    const existingTodo: Todo = {
      id: 't1',
      repoId: 'repo-1',
      title: 'T1',
      note: 'note',
      done: false,
      createdAt: 1,
      updatedAt: 1,
      listId: 'custom-list',
      important: true,
      steps: [{ id: 's1', title: 'Step', done: false, updatedAt: 1 }]
    }
    const state = makeState({
      todosByRepo: { 'repo-1': [existingTodo] },
      todoListsByRepo: { 'repo-1': [existingList] }
    })
    normalizeTodoState(state)
    expect(state.todosByRepo['repo-1'][0].listId).toBe('custom-list')
    expect(state.todosByRepo['repo-1'][0].important).toBe(true)
    expect(state.todosByRepo['repo-1'][0].steps).toHaveLength(1)
  })

  it('ensures default list exists even when custom lists are present', () => {
    const existingList: TodoList = {
      id: 'custom-list',
      repoId: 'repo-1',
      title: 'Custom',
      createdAt: 1,
      updatedAt: 1
    }
    const state = makeState({
      todosByRepo: { 'repo-1': [] },
      todoListsByRepo: { 'repo-1': [existingList] }
    })
    normalizeTodoState(state)
    expect(state.todoListsByRepo!['repo-1']).toContainEqual(
      expect.objectContaining({ id: DEFAULT_TODO_LIST_ID })
    )
    expect(state.todoListsByRepo!['repo-1']).toContainEqual(existingList)
  })

  it('does not change when already normalized with default list', () => {
    const now = Date.now()
    const state = makeState({
      todosByRepo: {
        'repo-1': [
          {
            id: 't1',
            repoId: 'repo-1',
            title: 'T1',
            note: '',
            done: false,
            createdAt: 1,
            updatedAt: 1,
            listId: DEFAULT_TODO_LIST_ID,
            important: false,
            steps: []
          }
        ]
      },
      todoListsByRepo: {
        'repo-1': [makeDefaultTodoList('repo-1', now)]
      },
      globalTodos: [],
      globalTodoLists: [makeDefaultTodoList('', now)]
    })
    const changed = normalizeTodoState(state)
    expect(changed).toBe(false)
  })
})
