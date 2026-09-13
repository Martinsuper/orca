import type { StoreApi } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { AppState } from '../types'

const ERROR_TOAST_DURATION = 60_000

type ProjectLinksStoreSet = StoreApi<AppState>['setState']
type ProjectLinksStoreGet = StoreApi<AppState>['getState']

export type ProjectLinksTransferActions = {
  exportProjectLinks: (args: { repoId: string }) => Promise<void>
  importProjectLinks: (args: { repoId: string }) => Promise<void>
}

export function createProjectLinksTransferActions(
  set: ProjectLinksStoreSet,
  get: ProjectLinksStoreGet
): ProjectLinksTransferActions {
  return {
    exportProjectLinks: async ({ repoId }) => {
      try {
        const result = await window.api.projectLinks.export({ repoId })
        if (result.ok) {
          toast.success(
            translate(
              'auto.store.slices.project.links.exportSuccess',
              'Exported {count} link(s) to {path}'
            )
              .replace('{count}', String(result.linkCount))
              .replace('{path}', result.filePath)
          )
        } else if (!result.cancelled) {
          toast.error(
            translate('auto.store.slices.project.links.exportFailed', 'Failed to export links'),
            { description: result.error, duration: ERROR_TOAST_DURATION }
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          translate('auto.store.slices.project.links.exportFailed', 'Failed to export links'),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
      }
    },
    importProjectLinks: async ({ repoId }) => {
      try {
        const result = await window.api.projectLinks.import({ repoId })
        if (result.ok) {
          set((state) => {
            const projectLinksByRepo = { ...state.projectLinksByRepo }
            delete projectLinksByRepo[repoId]
            const projectLinkFoldersByRepo = { ...state.projectLinkFoldersByRepo }
            delete projectLinkFoldersByRepo[repoId]
            return { projectLinksByRepo, projectLinkFoldersByRepo }
          })
          await get().fetchProjectLinks(repoId)
          await get().fetchProjectLinkFolders(repoId)
          toast.success(
            translate(
              'auto.store.slices.project.links.importSuccess',
              'Imported {imported} link(s), skipped {skipped}'
            )
              .replace('{imported}', String(result.importedLinks))
              .replace('{skipped}', String(result.skippedLinks))
          )
        } else if (!result.cancelled) {
          toast.error(
            translate('auto.store.slices.project.links.importFailed', 'Failed to import links'),
            { description: result.error, duration: ERROR_TOAST_DURATION }
          )
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        toast.error(
          translate('auto.store.slices.project.links.importFailed', 'Failed to import links'),
          { description: message, duration: ERROR_TOAST_DURATION }
        )
      }
    }
  }
}
