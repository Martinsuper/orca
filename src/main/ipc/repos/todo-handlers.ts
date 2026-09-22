import { randomUUID } from 'node:crypto'
import { BrowserWindow, ipcMain, type WebContents } from 'electron'
import { isRegisteredTodoEventRenderer } from '../../window/todo-event-renderers'
import type { Todo, TodoList } from '../../../shared/types'
import { DEFAULT_TODO_LIST_ID } from '../../persistence/loading-store/todo-normalization'
import type { TodoReminderScheduler } from '../../persistence/loading-store/todo-reminder-scheduler'
import {
  normalizeListTitle,
  normalizeNote,
  normalizeSteps,
  normalizeTitle,
  type SaveTodoArgs,
  validateDate,
  validateReminderAt
} from './todo-input-normalization'

function isTodoEventRenderer(contents: WebContents): boolean {
  return isRegisteredTodoEventRenderer(contents)
}

function notify(channel: string, payload?: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || !isTodoEventRenderer(window.webContents)) {
      continue
    }
    try {
      window.webContents.send(channel, payload)
    } catch {
      continue
    }
  }
}

type TodoStore = {
  getRepo(repoId: string): unknown
  getTodos(repoId: string): Todo[]
  saveTodo(todo: Todo): Todo
  removeTodo(repoId: string, todoId: string): void
  toggleTodo(repoId: string, todoId: string, done: boolean): Todo | null
  getTodoLists(repoId: string): TodoList[]
  saveTodoList(list: TodoList): TodoList
  removeTodoList(repoId: string, listId: string): void
  getGlobalTodos(): Todo[]
  saveGlobalTodo(todo: Todo): Todo
  removeGlobalTodo(todoId: string): void
  toggleGlobalTodo(todoId: string, done: boolean): Todo | null
  getGlobalTodoLists(): TodoList[]
  saveGlobalTodoList(list: TodoList): TodoList
  removeGlobalTodoList(listId: string): void
}

function validateTodoList(store: TodoStore, repoId: string, listId: string): void {
  const lists = repoId === '' ? store.getGlobalTodoLists() : store.getTodoLists(repoId)
  if (!lists.some((list) => list.id === listId)) {
    throw new Error(`Todo list "${listId}" not found in repo "${repoId}"`)
  }
}

export function registerTodoHandlers(
  _mainWindow: BrowserWindow | undefined,
  store: TodoStore,
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
    const listId = args.listId ?? existing?.listId ?? DEFAULT_TODO_LIST_ID
    validateTodoList(store, args.repoId, listId)
    const reminderAt =
      args.reminderAt === undefined ? existing?.reminderAt : validateReminderAt(args.reminderAt)
    const todo: Todo = {
      id: args.id ?? randomUUID(),
      repoId: args.repoId,
      title: normalizedTitle,
      note: normalizedNote,
      done: existing?.done ?? false,
      completedAt: existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      listId,
      important: args.important ?? existing?.important ?? false,
      dueDate: args.dueDate === undefined ? existing?.dueDate : validateDate(args.dueDate),
      reminderAt,
      reminderDeliveredAt:
        reminderAt === existing?.reminderAt ? existing?.reminderDeliveredAt : undefined,
      myDayDate:
        args.myDayDate === undefined
          ? existing?.myDayDate
          : validateDate(args.myDayDate, 'My Day date'),
      steps: normalizeSteps(args.steps) ?? existing?.steps ?? []
    }
    const saved = store.saveTodo(todo)
    notify('todos:changed', { repoId: args.repoId })
    reminderScheduler?.reconcile()
    return saved
  })

  ipcMain.handle(
    'todos:remove',
    (_event, { repoId, todoId }: { repoId: string; todoId: string }) => {
      store.removeTodo(repoId, todoId)
      notify('todos:changed', { repoId })
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
      notify('todos:changed', { repoId })
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
      notify('todos:listsChanged', { repoId })
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
      notify('todos:listsChanged', { repoId })
      notify('todos:changed', { repoId })
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
    if (args.id && !existing) {
      throw new Error(`Global todo "${args.id}" not found`)
    }
    const listId = args.listId ?? existing?.listId ?? DEFAULT_TODO_LIST_ID
    validateTodoList(store, '', listId)
    const reminderAt =
      args.reminderAt === undefined ? existing?.reminderAt : validateReminderAt(args.reminderAt)
    const todo: Todo = {
      id: args.id ?? randomUUID(),
      repoId: '',
      title: normalizedTitle,
      note: normalizedNote,
      done: existing?.done ?? false,
      completedAt: existing?.completedAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      listId,
      important: args.important ?? existing?.important ?? false,
      dueDate: args.dueDate === undefined ? existing?.dueDate : validateDate(args.dueDate),
      reminderAt,
      reminderDeliveredAt:
        reminderAt === existing?.reminderAt ? existing?.reminderDeliveredAt : undefined,
      myDayDate:
        args.myDayDate === undefined
          ? existing?.myDayDate
          : validateDate(args.myDayDate, 'My Day date'),
      steps: normalizeSteps(args.steps) ?? existing?.steps ?? []
    }
    const saved = store.saveGlobalTodo(todo)
    notify('todos:globalChanged')
    reminderScheduler?.reconcile()
    return saved
  })

  ipcMain.handle('todos:removeGlobal', (_event, { todoId }: { todoId: string }) => {
    store.removeGlobalTodo(todoId)
    notify('todos:globalChanged')
    reminderScheduler?.reconcile()
  })

  ipcMain.handle(
    'todos:toggleGlobal',
    (_event, { todoId, done }: { todoId: string; done: boolean }): Todo => {
      const updated = store.toggleGlobalTodo(todoId, done)
      if (!updated) {
        throw new Error(`Global todo "${todoId}" not found`)
      }
      notify('todos:globalChanged')
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
      notify('todos:globalListsChanged')
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
      notify('todos:globalListsChanged')
      notify('todos:globalChanged')
    }
  )
}
