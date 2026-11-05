import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'

export const plantumlApi = {
  render: (args) => ipcRenderer.invoke('plantuml:render', args)
} satisfies PreloadApi['plantuml']
