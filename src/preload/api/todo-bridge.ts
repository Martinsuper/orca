import { ipcRenderer } from 'electron'
import type { Todo, TodoList, TodoStep } from '../../shared/types'
import type { PreloadApi } from '../api-types'

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

export const todosApi = {
  list: (args: { repoId: string }) => ipcRenderer.invoke('todos:list', args) as Promise<Todo[]>,
  save: (args: SaveTodoArgs) => ipcRenderer.invoke('todos:save', args) as Promise<Todo>,
  remove: (args: { repoId: string; todoId: string }) =>
    ipcRenderer.invoke('todos:remove', args) as Promise<void>,
  toggle: (args: { repoId: string; todoId: string; done: boolean }) =>
    ipcRenderer.invoke('todos:toggle', args) as Promise<Todo>,
  onChanged: (callback: (data: { repoId: string }) => void) => {
    const listener = (_event: unknown, data: { repoId: string }) => callback(data)
    ipcRenderer.on('todos:changed', listener)
    return () => ipcRenderer.removeListener('todos:changed', listener)
  },
  listLists: (args: { repoId: string }) =>
    ipcRenderer.invoke('todos:listLists', args) as Promise<TodoList[]>,
  saveList: (args: { repoId: string; id?: string; title: string }) =>
    ipcRenderer.invoke('todos:saveList', args) as Promise<TodoList>,
  removeList: (args: { repoId: string; listId: string; confirmed: boolean }) =>
    ipcRenderer.invoke('todos:removeList', args) as Promise<void>,
  onListsChanged: (callback: (data: { repoId: string }) => void) => {
    const listener = (_event: unknown, data: { repoId: string }) => callback(data)
    ipcRenderer.on('todos:listsChanged', listener)
    return () => ipcRenderer.removeListener('todos:listsChanged', listener)
  },
  listGlobal: () => ipcRenderer.invoke('todos:listGlobal') as Promise<Todo[]>,
  saveGlobal: (args: {
    id?: string
    listId?: string
    title: string
    note?: string
    important?: boolean
    dueDate?: string
    reminderAt?: number
    myDayDate?: string
    steps?: TodoStep[]
  }) => ipcRenderer.invoke('todos:saveGlobal', args) as Promise<Todo>,
  removeGlobal: (args: { todoId: string }) =>
    ipcRenderer.invoke('todos:removeGlobal', args) as Promise<void>,
  toggleGlobal: (args: { todoId: string; done: boolean }) =>
    ipcRenderer.invoke('todos:toggleGlobal', args) as Promise<Todo>,
  onGlobalChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('todos:globalChanged', listener)
    return () => ipcRenderer.removeListener('todos:globalChanged', listener)
  },
  listGlobalLists: () => ipcRenderer.invoke('todos:listGlobalLists') as Promise<TodoList[]>,
  saveGlobalList: (args: { id?: string; title: string }) =>
    ipcRenderer.invoke('todos:saveGlobalList', args) as Promise<TodoList>,
  removeGlobalList: (args: { listId: string; confirmed: boolean }) =>
    ipcRenderer.invoke('todos:removeGlobalList', args) as Promise<void>,
  onGlobalListsChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('todos:globalListsChanged', listener)
    return () => ipcRenderer.removeListener('todos:globalListsChanged', listener)
  }
} satisfies PreloadApi['todos']
