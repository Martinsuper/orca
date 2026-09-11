import { randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import type { Store } from '../../persistence'
import type { Todo, TodoList, TodoStep } from '../../../shared/types'
import { DEFAULT_TODO_LIST_ID } from '../../persistence/loading-store/todo-normalization'
import type { TodoReminderScheduler } from '../../persistence/loading-store/todo-reminder-scheduler'

const MAX_TITLE_LENGTH = 500
const MAX_NOTE_LENGTH = 2000
const MAX_STEP_TITLE_LENGTH = 500

function normalizeTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('Title must not be empty.')
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return trimmed.slice(0, MAX_TITLE_LENGTH)
  }
  return trimmed
}

function normalizeNote(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  if (trimmed.length > MAX_NOTE_LENGTH) {
    return trimmed.slice(0, MAX_NOTE_LENGTH)
  }
  return trimmed
}

function normalizeSteps(steps: TodoStep[] | undefined): TodoStep[] {
  if (!steps || steps.length === 0) {
    return []
  }
  const now = Date.now()
  return steps.map((step) => ({
    id: step.id || randomUUID(),
    title: step.title.trim().slice(0, MAX_STEP_TITLE_LENGTH),
    done: step.done ?? false,
    updatedAt: step.updatedAt ?? now
  }))
}

function normalizeListTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('List title must not be empty.')
  }
  if (trimmed.length > MAX_TITLE_LENGTH) {
    return trimmed.slice(0, MAX_TITLE_LENGTH)
  }
  return trimmed
}

function validateDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Due date must be in YYYY-MM-DD format.')
  }
  return value
}

function notify(window: BrowserWindow, channel: string, payload?: unknown): void {
  if (!window.isDestroyed()) {
    window.webContents.send(channel, payload)
  }
}

type SaveTodoArgs = {
  repoId: string
  id?: string
  listId?: string
  title: string
  note?: string
  important?: boolean
  dueDate?: string
  reminderAt?: number
  myDayDate?: string
  steps?: TodoStep[]
}

export function registerTodoHandlers(
  mainWindow: BrowserWindow,
  store: Store,
  reminderScheduler?: TodoReminderScheduler
): void {
  for (const channel of [
    'todos:list',
    'todos:save',
    'todos:remove',
    'todos:toggle',
    'todos:listLists',
    'todos:saveList',
    'todos:removeList',
    'todos:listGlobal',
    'todos:saveGlobal',
    'todos:removeGlobal',
    'todos:toggleGlobal',
    'todos:listGlobalLists',
    'todos:saveGlobalList',
    'todos:removeGlobalList'
  ]) {
    ipcMain.removeHandler(channel)
  }

  // ── Per-repo todos ──────────────────────────────────────────

  ipcMain.handle('todos:list', (_event, { repoId }: { repoId: string }) => {
    return store.getTodos(repoId)
  })

  ipcMain.handle('todos:save', (_event, args: SaveTodoArgs): Todo => {
    if (args.repoId !== '' && !store.getRepo(args.repoId)) {
      throw new Error(`Repo "${args.repoId}" not found`)
    }
    const normalizedTitle = normalizeTitle(args.title)
    const normalizedNote = normalizeNote(args.note)
    const now = Date.now()
    const existing = args.id ? store.getTodos(args.repoId).find((t) => t.id === args.id) : undefined
    if (args.id && !existing) {
      throw new Error(`Todo "${args.id}" not found in repo "${args.repoId}"`)
    }
    const todo: Todo = {
      id: args.id ?? randomUUID(),
      repoId: args.repoId,
      title: normalizedTitle,
      note: normalizedNote,
      done: existing?.done ?? false,
      completedAt: existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      listId: args.listId ?? existing?.listId ?? DEFAULT_TODO_LIST_ID,
      important: args.important ?? existing?.important ?? false,
      dueDate: validateDate(args.dueDate) ?? existing?.dueDate,
      reminderAt: args.reminderAt ?? existing?.reminderAt,
      reminderDeliveredAt: existing?.reminderDeliveredAt,
      myDayDate: args.myDayDate ?? existing?.myDayDate,
      steps: normalizeSteps(args.steps) ?? existing?.steps ?? []
    }
    const saved = store.saveTodo(todo)
    notify(mainWindow, 'todos:changed', { repoId: args.repoId })
    reminderScheduler?.reconcile()
    return saved
  })

  ipcMain.handle(
    'todos:remove',
    (_event, { repoId, todoId }: { repoId: string; todoId: string }) => {
      store.removeTodo(repoId, todoId)
      notify(mainWindow, 'todos:changed', { repoId })
      reminderScheduler?.reconcile()
    }
  )

  ipcMain.handle(
    'todos:toggle',
    (_event, { repoId, todoId, done }: { repoId: string; todoId: string; done: boolean }): Todo => {
      const updated = store.toggleTodo(repoId, todoId, done)
      if (!updated) {
        throw new Error(`Todo "${todoId}" not found in repo "${repoId}"`)
      }
      notify(mainWindow, 'todos:changed', { repoId })
      reminderScheduler?.reconcile()
      return updated
    }
  )

  // ── Per-repo todo lists ─────────────────────────────────────

  ipcMain.handle('todos:listLists', (_event, { repoId }: { repoId: string }) => {
    return store.getTodoLists(repoId)
  })

  ipcMain.handle(
    'todos:saveList',
    (_event, { repoId, id, title }: { repoId: string; id?: string; title: string }): TodoList => {
      if (repoId !== '' && !store.getRepo(repoId)) {
        throw new Error(`Repo "${repoId}" not found`)
      }
      const normalizedTitle = normalizeListTitle(title)
      const now = Date.now()
      const existing = id ? store.getTodoLists(repoId).find((l) => l.id === id) : undefined
      if (id && !existing) {
        throw new Error(`Todo list "${id}" not found in repo "${repoId}"`)
      }
      const list: TodoList = {
        id: id ?? randomUUID(),
        repoId,
        title: normalizedTitle,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      }
      const saved = store.saveTodoList(list)
      notify(mainWindow, 'todos:listsChanged', { repoId })
      return saved
    }
  )

  ipcMain.handle(
    'todos:removeList',
    (
      _event,
      { repoId, listId, confirmed }: { repoId: string; listId: string; confirmed: boolean }
    ) => {
      if (!confirmed) {
        throw new Error('Confirmation required to delete a list.')
      }
      store.removeTodoList(repoId, listId)
      notify(mainWindow, 'todos:listsChanged', { repoId })
      notify(mainWindow, 'todos:changed', { repoId })
    }
  )

  // ── Global todos (backward-compat adapters) ─────────────────

  ipcMain.handle('todos:listGlobal', () => {
    return store.getGlobalTodos()
  })

  ipcMain.handle('todos:saveGlobal', (_event, args: Omit<SaveTodoArgs, 'repoId'>): Todo => {
    const normalizedTitle = normalizeTitle(args.title)
    const normalizedNote = normalizeNote(args.note)
    const now = Date.now()
    const existing = args.id ? store.getGlobalTodos().find((t) => t.id === args.id) : undefined
    const todo: Todo = {
      id: args.id ?? randomUUID(),
      repoId: '',
      title: normalizedTitle,
      note: normalizedNote,
      done: existing?.done ?? false,
      completedAt: existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      listId: args.listId ?? existing?.listId ?? DEFAULT_TODO_LIST_ID,
      important: args.important ?? existing?.important ?? false,
      dueDate: validateDate(args.dueDate) ?? existing?.dueDate,
      reminderAt: args.reminderAt ?? existing?.reminderAt,
      reminderDeliveredAt: existing?.reminderDeliveredAt,
      myDayDate: args.myDayDate ?? existing?.myDayDate,
      steps: normalizeSteps(args.steps) ?? existing?.steps ?? []
    }
    const saved = store.saveGlobalTodo(todo)
    notify(mainWindow, 'todos:globalChanged')
    reminderScheduler?.reconcile()
    return saved
  })

  ipcMain.handle('todos:removeGlobal', (_event, { todoId }: { todoId: string }) => {
    store.removeGlobalTodo(todoId)
    notify(mainWindow, 'todos:globalChanged')
    reminderScheduler?.reconcile()
  })

  ipcMain.handle(
    'todos:toggleGlobal',
    (_event, { todoId, done }: { todoId: string; done: boolean }): Todo => {
      const updated = store.toggleGlobalTodo(todoId, done)
      if (!updated) {
        throw new Error(`Global todo "${todoId}" not found`)
      }
      notify(mainWindow, 'todos:globalChanged')
      reminderScheduler?.reconcile()
      return updated
    }
  )

  // ── Global todo lists ───────────────────────────────────────

  ipcMain.handle('todos:listGlobalLists', () => {
    return store.getGlobalTodoLists()
  })

  ipcMain.handle(
    'todos:saveGlobalList',
    (_event, { id, title }: { id?: string; title: string }): TodoList => {
      const normalizedTitle = normalizeListTitle(title)
      const now = Date.now()
      const existing = id ? store.getGlobalTodoLists().find((l) => l.id === id) : undefined
      if (id && !existing) {
        throw new Error(`Global todo list "${id}" not found`)
      }
      const list: TodoList = {
        id: id ?? randomUUID(),
        repoId: '',
        title: normalizedTitle,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      }
      const saved = store.saveGlobalTodoList(list)
      notify(mainWindow, 'todos:globalListsChanged')
      return saved
    }
  )

  ipcMain.handle(
    'todos:removeGlobalList',
    (_event, { listId, confirmed }: { listId: string; confirmed: boolean }) => {
      if (!confirmed) {
        throw new Error('Confirmation required to delete a list.')
      }
      store.removeGlobalTodoList(listId)
      notify(mainWindow, 'todos:globalListsChanged')
      notify(mainWindow, 'todos:globalChanged')
    }
  )
}
