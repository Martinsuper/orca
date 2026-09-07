import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const projectLinksApi = {
  list: (args) => ipcRenderer.invoke('projectLinks:list', args),
  save: (args) => ipcRenderer.invoke('projectLinks:save', args),
  remove: (args) => ipcRenderer.invoke('projectLinks:remove', args),
  reorder: (args) => ipcRenderer.invoke('projectLinks:reorder', args),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { repoId: string }) => callback(data)
    ipcRenderer.on('projectLinks:changed', listener)
    return () => ipcRenderer.removeListener('projectLinks:changed', listener)
  },
  listGlobal: () => ipcRenderer.invoke('projectLinks:listGlobal'),
  saveGlobal: (args) => ipcRenderer.invoke('projectLinks:saveGlobal', args),
  removeGlobal: (args) => ipcRenderer.invoke('projectLinks:removeGlobal', args),
  reorderGlobal: (args) => ipcRenderer.invoke('projectLinks:reorderGlobal', args),
  onGlobalChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('projectLinks:globalChanged', listener)
    return () => ipcRenderer.removeListener('projectLinks:globalChanged', listener)
  },
  export: (args) => ipcRenderer.invoke('projectLinks:export', args),
  import: (args) => ipcRenderer.invoke('projectLinks:import', args)
} satisfies PreloadApi['projectLinks']

export const projectLinkFoldersApi = {
  list: (args) => ipcRenderer.invoke('projectLinkFolders:list', args),
  add: (args) => ipcRenderer.invoke('projectLinkFolders:add', args),
  remove: (args) => ipcRenderer.invoke('projectLinkFolders:remove', args),
  onChanged: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { repoId: string }) => callback(data)
    ipcRenderer.on('projectLinkFolders:changed', listener)
    return () => ipcRenderer.removeListener('projectLinkFolders:changed', listener)
  },
  listGlobal: () => ipcRenderer.invoke('projectLinkFolders:listGlobal'),
  addGlobal: (args) => ipcRenderer.invoke('projectLinkFolders:addGlobal', args),
  removeGlobal: (args) => ipcRenderer.invoke('projectLinkFolders:removeGlobal', args),
  onGlobalChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('projectLinkFolders:globalChanged', listener)
    return () => ipcRenderer.removeListener('projectLinkFolders:globalChanged', listener)
  }
} satisfies PreloadApi['projectLinkFolders']
