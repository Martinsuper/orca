import type { Todo, TodoList } from '../../../shared/types'
import type { PersistedState } from '../../../shared/persisted-state-types'

const DEFAULT_LIST_TITLE = 'Tasks'

export const DEFAULT_TODO_LIST_ID = 'default'

export function makeDefaultTodoList(repoId: string, now: number): TodoList {
  return {
    id: DEFAULT_TODO_LIST_ID,
    repoId,
    title: DEFAULT_LIST_TITLE,
    createdAt: now,
    updatedAt: now
  }
}

function normalizeTodo(todo: Todo, defaultListId: string): Todo {
  return {
    ...todo,
    listId: todo.listId ?? defaultListId,
    important: todo.important ?? false,
    steps: todo.steps ?? [],
    note: todo.note ?? '',
    done: todo.done ?? false
  }
}

function normalizeScopeTodos(
  todos: Todo[] | undefined,
  lists: TodoList[] | undefined,
  repoId: string,
  now: number
): { todos: Todo[]; lists: TodoList[]; changed: boolean } {
  const inputTodos = todos ?? []
  const inputLists = lists ?? []
  let changed = false
  let resolvedLists = inputLists
  if (resolvedLists.length === 0) {
    resolvedLists = [makeDefaultTodoList(repoId, now)]
    changed = true
  } else if (!resolvedLists.some((l) => l.id === DEFAULT_TODO_LIST_ID)) {
    resolvedLists = [makeDefaultTodoList(repoId, now), ...resolvedLists]
    changed = true
  }
  const normalizedTodos = inputTodos.map((todo) => {
    const result = normalizeTodo(todo, DEFAULT_TODO_LIST_ID)
    if (
      result.listId !== todo.listId ||
      result.important !== todo.important ||
      result.steps !== todo.steps ||
      result.note !== todo.note ||
      result.done !== todo.done
    ) {
      changed = true
    }
    return result
  })
  return { todos: normalizedTodos, lists: resolvedLists, changed }
}

export function normalizeTodoState(state: PersistedState): boolean {
  const now = Date.now()
  let changed = false

  if (!state.todoListsByRepo) {
    state.todoListsByRepo = {}
  }
  if (!state.globalTodoLists) {
    state.globalTodoLists = []
  }

  for (const repoId of Object.keys(state.todosByRepo)) {
    const result = normalizeScopeTodos(
      state.todosByRepo[repoId],
      state.todoListsByRepo[repoId],
      repoId,
      now
    )
    state.todosByRepo[repoId] = result.todos
    state.todoListsByRepo[repoId] = result.lists
    if (result.changed) {
      changed = true
    }
  }

  const globalResult = normalizeScopeTodos(state.globalTodos, state.globalTodoLists, '', now)
  state.globalTodos = globalResult.todos
  state.globalTodoLists = globalResult.lists
  if (globalResult.changed) {
    changed = true
  }

  return changed
}
