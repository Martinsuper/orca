import type { ProjectLink, Todo, TodoList, TodoStep } from '../../shared/types'

export type ProjectLinksApi = {
  list: (args: { repoId: string }) => Promise<ProjectLink[]>
  save: (args: {
    repoId: string
    id?: string
    name: string
    url: string
    category: string
  }) => Promise<ProjectLink>
  remove: (args: { repoId: string; linkId: string }) => Promise<void>
  reorder: (args: {
    repoId: string
    updates: { id: string; category: string; order: number }[]
  }) => Promise<void>
  onChanged: (callback: (data: { repoId: string }) => void) => () => void
  listGlobal: () => Promise<ProjectLink[]>
  saveGlobal: (args: {
    id?: string
    name: string
    url: string
    category: string
  }) => Promise<ProjectLink>
  removeGlobal: (args: { linkId: string }) => Promise<void>
  reorderGlobal: (args: {
    updates: { id: string; category: string; order: number }[]
  }) => Promise<void>
  onGlobalChanged: (callback: () => void) => () => void
  export: (args: {
    repoId: string
  }) => Promise<
    | { ok: true; filePath: string; linkCount: number; folderCount: number }
    | { ok: false; cancelled?: boolean; error?: string }
  >
  import: (args: { repoId: string }) => Promise<
    | {
        ok: true
        importedLinks: number
        skippedLinks: number
        duplicatesInFile: number
        importedFolders: number
        skippedFolders: number
      }
    | { ok: false; cancelled?: boolean; error?: string }
  >
}

export type TodosApi = {
  list: (args: { repoId: string }) => Promise<Todo[]>
  save: (args: {
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
  }) => Promise<Todo>
  remove: (args: { repoId: string; todoId: string }) => Promise<void>
  toggle: (args: { repoId: string; todoId: string; done: boolean }) => Promise<Todo>
  onChanged: (callback: (data: { repoId: string }) => void) => () => void
  listLists: (args: { repoId: string }) => Promise<TodoList[]>
  saveList: (args: { repoId: string; id?: string; title: string }) => Promise<TodoList>
  removeList: (args: { repoId: string; listId: string; confirmed: boolean }) => Promise<void>
  onListsChanged: (callback: (data: { repoId: string }) => void) => () => void
  listGlobal: () => Promise<Todo[]>
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
  }) => Promise<Todo>
  removeGlobal: (args: { todoId: string }) => Promise<void>
  toggleGlobal: (args: { todoId: string; done: boolean }) => Promise<Todo>
  onGlobalChanged: (callback: () => void) => () => void
  listGlobalLists: () => Promise<TodoList[]>
  saveGlobalList: (args: { id?: string; title: string }) => Promise<TodoList>
  removeGlobalList: (args: { listId: string; confirmed: boolean }) => Promise<void>
  onGlobalListsChanged: (callback: () => void) => () => void
}

export type ProjectLinkFoldersApi = {
  list: (args: { repoId: string }) => Promise<string[]>
  add: (args: { repoId: string; path: string }) => Promise<void>
  remove: (args: { repoId: string; path: string }) => Promise<void>
  onChanged: (callback: (data: { repoId: string }) => void) => () => void
  listGlobal: () => Promise<string[]>
  addGlobal: (args: { path: string }) => Promise<void>
  removeGlobal: (args: { path: string }) => Promise<void>
  onGlobalChanged: (callback: () => void) => () => void
}
