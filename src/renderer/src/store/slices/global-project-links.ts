import type { StoreApi } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { ProjectLink } from '../../../../shared/types'
import type { AppState } from '../types'
import type { ProjectLinksLoadStatus } from './project-links'

const ERROR_TOAST_DURATION = 60_000

type ProjectLinksStoreSet = StoreApi<AppState>['setState']
type ProjectLinksStoreGet = StoreApi<AppState>['getState']

export type GlobalProjectLinksState = {
  globalProjectLinks: ProjectLink[] | undefined
  globalProjectLinksLoading: boolean
  globalProjectLinksLoadStatus: ProjectLinksLoadStatus
  globalProjectLinksError: string | undefined
  globalProjectLinkFolders: string[] | undefined
  fetchGlobalProjectLinks: () => Promise<void>
  saveGlobalProjectLink: (args: {
    id?: string
    name: string
    url: string
    category: string
  }) => Promise<ProjectLink | null>
  removeGlobalProjectLink: (args: { linkId: string }) => Promise<void>
  reorderGlobalProjectLinks: (args: {
    updates: { id: string; category: string; order: number }[]
  }) => Promise<void>
  fetchGlobalProjectLinkFolders: () => Promise<void>
  addGlobalProjectLinkFolder: (args: { path: string }) => Promise<void>
  removeGlobalProjectLinkFolder: (args: { path: string }) => Promise<void>
}

export function createGlobalProjectLinksState(
  set: ProjectLinksStoreSet,
  get: ProjectLinksStoreGet
): GlobalProjectLinksState {
  return {
    globalProjectLinks: undefined,
    globalProjectLinksLoading: false,
    globalProjectLinksLoadStatus: 'idle',
    globalProjectLinksError: undefined,
    globalProjectLinkFolders: undefined,
    fetchGlobalProjectLinks: async () => {
      const state = get()
      if (state.globalProjectLinks !== undefined || state.globalProjectLinksLoading) {
        return
      }
      set({
        globalProjectLinksLoading: true,
        globalProjectLinksLoadStatus: 'loading',
        globalProjectLinksError: undefined
      })
      try {
        const links = await window.api.projectLinks.listGlobal()
        set({
          globalProjectLinks: links,
          globalProjectLinksLoading: false,
          globalProjectLinksLoadStatus: 'loaded',
          globalProjectLinksError: undefined
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        set({
          globalProjectLinksLoading: false,
          globalProjectLinksLoadStatus: 'error',
          globalProjectLinksError: message
        })
        console.error('Failed to fetch global project links:', err)
      }
    },
    saveGlobalProjectLink: async (args) => {
      try {
        if (get().globalProjectLinks === undefined) {
          await get().fetchGlobalProjectLinks()
          if (get().globalProjectLinks === undefined) {
            toast.error(
              args.id
                ? translate('auto.store.slices.project.links.updateFailed', 'Failed to update link')
                : translate('auto.store.slices.project.links.saveFailed', 'Failed to save link'),
              {
                description: translate(
                  'auto.store.slices.project.links.mustLoadFirst',
                  'Links must load before saving.'
                ),
                duration: ERROR_TOAST_DURATION
              }
            )
            return null
          }
        }
        const saved = await window.api.projectLinks.saveGlobal(args)
        set((state) => {
          const existing = state.globalProjectLinks
          if (existing === undefined) {
            return {}
          }
          const index = existing.findIndex((link) => link.id === saved.id)
          return {
            globalProjectLinks:
              index === -1
                ? [...existing, saved]
                : existing.map((link, itemIndex) => (itemIndex === index ? saved : link))
          }
        })
        return saved
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          args.id
            ? translate('auto.store.slices.project.links.updateFailed', 'Failed to update link')
            : translate('auto.store.slices.project.links.saveFailed', 'Failed to save link'),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
        return null
      }
    },
    removeGlobalProjectLink: async ({ linkId }) => {
      const previous = get().globalProjectLinks ?? []
      set({ globalProjectLinks: previous.filter((link) => link.id !== linkId) })
      try {
        await window.api.projectLinks.removeGlobal({ linkId })
      } catch (err) {
        set({ globalProjectLinks: previous })
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          translate('auto.store.slices.project.links.removeFailed', 'Failed to remove link'),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
        throw err
      }
    },
    reorderGlobalProjectLinks: async ({ updates }) => {
      const previous = get().globalProjectLinks ?? []
      const updatesById = new Map(updates.map((update) => [update.id, update]))
      set({
        globalProjectLinks: previous.map((link) => {
          const update = updatesById.get(link.id)
          return update ? { ...link, category: update.category, order: update.order } : link
        })
      })
      try {
        await window.api.projectLinks.reorderGlobal({ updates })
      } catch (err) {
        set({ globalProjectLinks: previous })
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          translate('auto.store.slices.project.links.reorderFailed', 'Failed to reorder links'),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
        throw err
      }
    },
    fetchGlobalProjectLinkFolders: async () => {
      if (get().globalProjectLinkFolders !== undefined) {
        return
      }
      try {
        const folders = await window.api.projectLinkFolders.listGlobal()
        set({ globalProjectLinkFolders: folders })
      } catch (err) {
        console.error('Failed to fetch global project link folders:', err)
      }
    },
    addGlobalProjectLinkFolder: async ({ path }) => {
      const previous = get().globalProjectLinkFolders ?? []
      if (!previous.includes(path)) {
        set({
          globalProjectLinkFolders: [...previous, path].sort((left, right) =>
            left.localeCompare(right)
          )
        })
      }
      try {
        await window.api.projectLinkFolders.addGlobal({ path })
      } catch (err) {
        set({ globalProjectLinkFolders: previous })
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          translate('auto.store.slices.project.links.folderAddFailed', 'Failed to add folder'),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
        throw err
      }
    },
    removeGlobalProjectLinkFolder: async ({ path }) => {
      const previous = get().globalProjectLinkFolders ?? []
      set({ globalProjectLinkFolders: previous.filter((entry) => entry !== path) })
      try {
        await window.api.projectLinkFolders.removeGlobal({ path })
      } catch (err) {
        set({ globalProjectLinkFolders: previous })
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          translate(
            'auto.store.slices.project.links.folderRemoveFailed',
            'Failed to remove folder'
          ),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
        throw err
      }
    }
  }
}
