import type { Todo, TodoList } from '../../../shared/types'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { StoreRuntimeState } from './store-runtime-state'
import type { WriteSchedulingOperations } from './write-scheduling'
import { scheduleSave } from './write-scheduling'
import { DEFAULT_TODO_LIST_ID, makeDefaultTodoList } from './todo-normalization'

const todoPersistenceContext = Symbol('TodoPersistence')
type TodoPersistenceContext = {
  runtime: Pick<StoreRuntimeState, 'state'>
  scheduling: WriteSchedulingOperations
}

function sortTodos(todos: readonly Todo[]): Todo[] {
  return [...todos].sort((left, right) => left.createdAt - right.createdAt)
}

function sortLists(lists: readonly TodoList[]): TodoList[] {
  return [...lists].sort((left, right) => {
    if (left.id === DEFAULT_TODO_LIST_ID && right.id !== DEFAULT_TODO_LIST_ID) {
      return -1
    }
    if (left.id !== DEFAULT_TODO_LIST_ID && right.id === DEFAULT_TODO_LIST_ID) {
      return 1
    }
    return left.createdAt - right.createdAt
  })
}

function ensureLists(state: PersistedState, repoId: string): TodoList[] {
  if (!state.todoListsByRepo) {
    state.todoListsByRepo = {}
  }
  if (repoId === '') {
    if (!state.globalTodoLists || state.globalTodoLists.length === 0) {
      const now = Date.now()
      state.globalTodoLists = [makeDefaultTodoList('', now)]
      return state.globalTodoLists
    }
    return state.globalTodoLists
  }
  if (!state.todoListsByRepo[repoId] || state.todoListsByRepo[repoId].length === 0) {
    const now = Date.now()
    state.todoListsByRepo[repoId] = [makeDefaultTodoList(repoId, now)]
  }
  return state.todoListsByRepo[repoId]
}

export class TodoPersistence {
  readonly [todoPersistenceContext]: TodoPersistenceContext

  constructor(runtime: Pick<StoreRuntimeState, 'state'>, scheduling: WriteSchedulingOperations) {
    this[todoPersistenceContext] = { runtime, scheduling }
  }

  // ── Per-repo todos ──────────────────────────────────────────

  getTodos(repoId: string): Todo[] {
    return sortTodos(this[todoPersistenceContext].runtime.state.todosByRepo[repoId] ?? [])
  }

  saveTodo(todo: Todo): Todo {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const existing = runtime.state.todosByRepo[todo.repoId] ?? []
    const index = existing.findIndex((entry) => entry.id === todo.id)
    runtime.state.todosByRepo[todo.repoId] =
      index === -1 ? [...existing, todo] : existing.map((entry, i) => (i === index ? todo : entry))
    scheduleSave(scheduling)
    return todo
  }

  removeTodo(repoId: string, todoId: string): void {
    const { runtime, scheduling } = this[todoPersistenceContext]
    runtime.state.todosByRepo[repoId] = (runtime.state.todosByRepo[repoId] ?? []).filter(
      (entry) => entry.id !== todoId
    )
    scheduleSave(scheduling)
  }

  toggleTodo(repoId: string, todoId: string, done: boolean): Todo | null {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const todos = runtime.state.todosByRepo[repoId] ?? []
    let updated: Todo | null = null
    const now = Date.now()
    runtime.state.todosByRepo[repoId] = todos.map((entry) => {
      if (entry.id === todoId) {
        updated = {
          ...entry,
          done,
          completedAt: done ? now : undefined,
          updatedAt: now
        }
        return updated
      }
      return entry
    })
    if (updated) {
      scheduleSave(scheduling)
    }
    return updated
  }

  // ── Global todos ────────────────────────────────────────────

  getGlobalTodos(): Todo[] {
    return sortTodos(this[todoPersistenceContext].runtime.state.globalTodos ?? [])
  }

  saveGlobalTodo(todo: Todo): Todo {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const existing = runtime.state.globalTodos ?? []
    const index = existing.findIndex((entry) => entry.id === todo.id)
    runtime.state.globalTodos =
      index === -1 ? [...existing, todo] : existing.map((entry, i) => (i === index ? todo : entry))
    scheduleSave(scheduling)
    return todo
  }

  removeGlobalTodo(todoId: string): void {
    const { runtime, scheduling } = this[todoPersistenceContext]
    runtime.state.globalTodos = (runtime.state.globalTodos ?? []).filter(
      (entry) => entry.id !== todoId
    )
    scheduleSave(scheduling)
  }

  toggleGlobalTodo(todoId: string, done: boolean): Todo | null {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const todos = runtime.state.globalTodos ?? []
    let updated: Todo | null = null
    const now = Date.now()
    runtime.state.globalTodos = todos.map((entry) => {
      if (entry.id === todoId) {
        updated = {
          ...entry,
          done,
          completedAt: done ? now : undefined,
          updatedAt: now
        }
        return updated
      }
      return entry
    })
    if (updated) {
      scheduleSave(scheduling)
    }
    return updated
  }

  // ── Per-repo todo lists ─────────────────────────────────────

  getTodoLists(repoId: string): TodoList[] {
    const state = this[todoPersistenceContext].runtime.state
    return sortLists(ensureLists(state, repoId))
  }

  saveTodoList(list: TodoList): TodoList {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const state = runtime.state
    const existing = ensureLists(state, list.repoId)
    const index = existing.findIndex((entry) => entry.id === list.id)
    const updated =
      index === -1 ? [...existing, list] : existing.map((entry, i) => (i === index ? list : entry))
    if (list.repoId === '') {
      state.globalTodoLists = updated
    } else {
      state.todoListsByRepo![list.repoId] = updated
    }
    scheduleSave(scheduling)
    return list
  }

  removeTodoList(repoId: string, listId: string): void {
    const { runtime, scheduling } = this[todoPersistenceContext]
    if (listId === DEFAULT_TODO_LIST_ID) {
      throw new Error('Cannot remove the default list')
    }
    const state = runtime.state
    const lists = ensureLists(state, repoId)
    state.todoListsByRepo![repoId] = lists.filter((entry) => entry.id !== listId)
    const remainingTodos = (state.todosByRepo[repoId] ?? []).map((todo) =>
      todo.listId === listId ? { ...todo, listId: DEFAULT_TODO_LIST_ID } : todo
    )
    state.todosByRepo[repoId] = remainingTodos
    scheduleSave(scheduling)
  }

  // ── Global todo lists ────────────────────────────────────────

  getGlobalTodoLists(): TodoList[] {
    const state = this[todoPersistenceContext].runtime.state
    return sortLists(ensureLists(state, ''))
  }

  saveGlobalTodoList(list: TodoList): TodoList {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const state = runtime.state
    const existing = ensureLists(state, '')
    const index = existing.findIndex((entry) => entry.id === list.id)
    state.globalTodoLists =
      index === -1 ? [...existing, list] : existing.map((entry, i) => (i === index ? list : entry))
    scheduleSave(scheduling)
    return list
  }

  removeGlobalTodoList(listId: string): void {
    const { runtime, scheduling } = this[todoPersistenceContext]
    if (listId === DEFAULT_TODO_LIST_ID) {
      throw new Error('Cannot remove the default list')
    }
    const state = runtime.state
    state.globalTodoLists = (state.globalTodoLists ?? []).filter((entry) => entry.id !== listId)
    const remainingTodos = (state.globalTodos ?? []).map((todo) =>
      todo.listId === listId ? { ...todo, listId: DEFAULT_TODO_LIST_ID } : todo
    )
    state.globalTodos = remainingTodos
    scheduleSave(scheduling)
  }

  // ── Repo lifecycle cleanup ──────────────────────────────────

  removeTodoDataForRepo(repoId: string): void {
    const { runtime, scheduling } = this[todoPersistenceContext]
    const state = runtime.state
    delete state.todosByRepo[repoId]
    if (state.todoListsByRepo) {
      delete state.todoListsByRepo[repoId]
    }
    scheduleSave(scheduling)
  }
}

export function installTodoPersistenceContext(target: object, source: TodoPersistence): void {
  Object.defineProperty(target, todoPersistenceContext, {
    value: source[todoPersistenceContext]
  })
}
