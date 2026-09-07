import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import type { BrowserWindow } from 'electron'
import { dialog, ipcMain } from 'electron'
import type { Store } from '../../persistence'
import type { ProjectLink } from '../../../shared/types'
import {
  PROJECT_LINKS_EXPORT_KIND,
  PROJECT_LINKS_EXPORT_SCHEMA_VERSION,
  type ProjectLinksExportEnvelope
} from '../../../shared/project-links-export'
import {
  mergeFoldersSkipDuplicates,
  mergeSkipDuplicates,
  parseProjectLinksExport
} from '../project-links-import-merge'
import {
  normalizeProjectLinkCategory,
  normalizeProjectLinkName,
  normalizeProjectLinkUrl
} from '../project-link-normalization'

type LinkUpdate = { id: string; category: string; order: number }

function normalizeFolderPath(value: string): string {
  const parts = value
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0 || parts.length > 5 || parts.some((part) => part.length > 40)) {
    throw new Error('Folder path is invalid.')
  }
  return parts.join('/')
}

function normalizeUpdates(updates: LinkUpdate[]): LinkUpdate[] {
  return updates.map(({ id, category, order }) => ({
    id,
    category: normalizeProjectLinkCategory(category),
    order
  }))
}

function notify(window: BrowserWindow, channel: string, payload?: unknown): void {
  if (!window.isDestroyed()) {
    window.webContents.send(channel, payload)
  }
}

export function registerProjectLinkHandlers(mainWindow: BrowserWindow, store: Store): void {
  for (const channel of [
    'projectLinks:list',
    'projectLinks:save',
    'projectLinks:remove',
    'projectLinks:reorder',
    'projectLinks:listGlobal',
    'projectLinks:saveGlobal',
    'projectLinks:removeGlobal',
    'projectLinks:reorderGlobal',
    'projectLinks:export',
    'projectLinks:import',
    'projectLinkFolders:list',
    'projectLinkFolders:add',
    'projectLinkFolders:remove',
    'projectLinkFolders:listGlobal',
    'projectLinkFolders:addGlobal',
    'projectLinkFolders:removeGlobal'
  ]) {
    ipcMain.removeHandler(channel)
  }

  ipcMain.handle('projectLinks:list', (_event, { repoId }: { repoId: string }) =>
    store.getProjectLinks(repoId)
  )
  ipcMain.handle('projectLinkFolders:list', (_event, { repoId }: { repoId: string }) =>
    store.getProjectLinkFolders(repoId)
  )
  ipcMain.handle('projectLinks:listGlobal', () => store.getGlobalProjectLinks())
  ipcMain.handle('projectLinkFolders:listGlobal', () => store.getGlobalProjectLinkFolders())

  ipcMain.handle(
    'projectLinks:save',
    (
      _event,
      args: { repoId: string; id?: string; name: string; url: string; category: string }
    ): ProjectLink => {
      if (!store.getRepo(args.repoId)) {
        throw new Error(`Repo "${args.repoId}" not found`)
      }
      const existing = args.id
        ? store.getProjectLinks(args.repoId).find((link) => link.id === args.id)
        : undefined
      const now = Date.now()
      const saved = store.saveProjectLink({
        id: existing?.id ?? randomUUID(),
        repoId: args.repoId,
        name: normalizeProjectLinkName(args.name),
        url: normalizeProjectLinkUrl(args.url),
        category: normalizeProjectLinkCategory(args.category),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      })
      notify(mainWindow, 'projectLinks:changed', { repoId: args.repoId })
      return saved
    }
  )
  ipcMain.handle(
    'projectLinks:remove',
    (_event, { repoId, linkId }: { repoId: string; linkId: string }) => {
      if (!store.getRepo(repoId)) {
        throw new Error(`Repo "${repoId}" not found`)
      }
      store.removeProjectLink(repoId, linkId)
      notify(mainWindow, 'projectLinks:changed', { repoId })
    }
  )
  ipcMain.handle(
    'projectLinks:reorder',
    (_event, { repoId, updates }: { repoId: string; updates: LinkUpdate[] }) => {
      if (!store.getRepo(repoId)) {
        throw new Error(`Repo "${repoId}" not found`)
      }
      store.reorderProjectLinks(repoId, normalizeUpdates(updates))
      notify(mainWindow, 'projectLinks:changed', { repoId })
    }
  )
  ipcMain.handle(
    'projectLinkFolders:add',
    (_event, { repoId, path }: { repoId: string; path: string }) => {
      if (!store.getRepo(repoId)) {
        throw new Error(`Repo "${repoId}" not found`)
      }
      store.addProjectLinkFolder(repoId, normalizeFolderPath(path))
      notify(mainWindow, 'projectLinkFolders:changed', { repoId })
    }
  )
  ipcMain.handle(
    'projectLinkFolders:remove',
    (_event, { repoId, path }: { repoId: string; path: string }) => {
      if (!store.getRepo(repoId)) {
        throw new Error(`Repo "${repoId}" not found`)
      }
      store.removeProjectLinkFolder(repoId, path)
      notify(mainWindow, 'projectLinkFolders:changed', { repoId })
    }
  )

  ipcMain.handle(
    'projectLinks:saveGlobal',
    (_event, args: { id?: string; name: string; url: string; category: string }): ProjectLink => {
      const existing = args.id
        ? store.getGlobalProjectLinks().find((link) => link.id === args.id)
        : undefined
      const now = Date.now()
      const saved = store.saveGlobalProjectLink({
        id: existing?.id ?? randomUUID(),
        repoId: '',
        name: normalizeProjectLinkName(args.name),
        url: normalizeProjectLinkUrl(args.url),
        category: normalizeProjectLinkCategory(args.category),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      })
      notify(mainWindow, 'projectLinks:globalChanged')
      return saved
    }
  )
  ipcMain.handle('projectLinks:removeGlobal', (_event, { linkId }: { linkId: string }) => {
    store.removeGlobalProjectLink(linkId)
    notify(mainWindow, 'projectLinks:globalChanged')
  })
  ipcMain.handle('projectLinks:reorderGlobal', (_event, { updates }: { updates: LinkUpdate[] }) => {
    store.reorderGlobalProjectLinks(normalizeUpdates(updates))
    notify(mainWindow, 'projectLinks:globalChanged')
  })
  ipcMain.handle('projectLinkFolders:addGlobal', (_event, { path }: { path: string }) => {
    store.addGlobalProjectLinkFolder(normalizeFolderPath(path))
    notify(mainWindow, 'projectLinkFolders:globalChanged')
  })
  ipcMain.handle('projectLinkFolders:removeGlobal', (_event, { path }: { path: string }) => {
    store.removeGlobalProjectLinkFolder(path)
    notify(mainWindow, 'projectLinkFolders:globalChanged')
  })

  ipcMain.handle('projectLinks:export', async (_event, { repoId }: { repoId: string }) => {
    const repo = store.getRepo(repoId)
    if (!repo) {
      return { ok: false as const, error: `Repo "${repoId}" not found` }
    }
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: `${repo.displayName || repo.id}.orca-links.json`,
        filters: [{ name: 'Orca Project Links', extensions: ['orca-links.json', 'json'] }]
      })
      if (result.canceled || !result.filePath) {
        return { ok: false as const, cancelled: true }
      }
      const links = store.getProjectLinks(repoId)
      const folders = store.getProjectLinkFolders(repoId)
      const payload: ProjectLinksExportEnvelope = {
        kind: PROJECT_LINKS_EXPORT_KIND,
        schemaVersion: PROJECT_LINKS_EXPORT_SCHEMA_VERSION,
        exportedAt: Date.now(),
        links: links.map(({ name, url, category, order }) => ({
          name,
          url,
          category,
          ...(order === undefined ? {} : { order })
        })),
        folders
      }
      await writeFile(result.filePath, JSON.stringify(payload, null, 2), 'utf8')
      return {
        ok: true as const,
        filePath: result.filePath,
        linkCount: links.length,
        folderCount: folders.length
      }
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Failed to export links'
      }
    }
  })
  ipcMain.handle('projectLinks:import', async (_event, { repoId }: { repoId: string }) => {
    if (!store.getRepo(repoId)) {
      return { ok: false as const, error: `Repo "${repoId}" not found` }
    }
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Orca Project Links', extensions: ['orca-links.json', 'json'] }]
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false as const, cancelled: true }
      }
      const parsed = parseProjectLinksExport(
        JSON.parse(await readFile(result.filePaths[0], 'utf8'))
      )
      const links = mergeSkipDuplicates(store.getProjectLinks(repoId), parsed.links)
      const folders = mergeFoldersSkipDuplicates(
        store.getProjectLinkFolders(repoId),
        parsed.folders
      )
      const now = Date.now()
      for (const link of links.toInsert) {
        store.saveProjectLink({ id: randomUUID(), repoId, ...link, createdAt: now, updatedAt: now })
      }
      for (const path of folders.toInsert) {
        store.addProjectLinkFolder(repoId, path)
      }
      if (links.toInsert.length) {
        notify(mainWindow, 'projectLinks:changed', { repoId })
      }
      if (folders.toInsert.length) {
        notify(mainWindow, 'projectLinkFolders:changed', { repoId })
      }
      return {
        ok: true as const,
        importedLinks: links.toInsert.length,
        skippedLinks: links.skipped,
        duplicatesInFile: links.duplicatesInFile,
        importedFolders: folders.toInsert.length,
        skippedFolders: folders.skipped
      }
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Failed to import links'
      }
    }
  })
}
