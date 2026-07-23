import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import type { AppState } from '../types'
import type { ProjectLink } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'

const ERROR_TOAST_DURATION = 60_000

// Why: mirror persistence's ordering — manual order ascending, missing order
// last, name as a stable tiebreak — so optimistic updates match the reload.
function compareProjectLinks(left: ProjectLink, right: ProjectLink): number {
  const leftOrder = left.order ?? Number.POSITIVE_INFINITY
  const rightOrder = right.order ?? Number.POSITIVE_INFINITY
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }
  return left.name.localeCompare(right.name)
}

export type ProjectLinksLoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

export type ProjectLinksSlice = {
  /** Per-repo link list. Lazily populated by `fetchProjectLinks`; missing
   *  key means "not yet fetched", empty array means "fetched, none exist". */
  projectLinksByRepo: Record<string, ProjectLink[]>
  /** Per-repo fetch guard so missing link buckets keep loading meaning. */
  projectLinksLoadingByRepo: Record<string, boolean>
  projectLinksLoadStatusByRepo: Record<string, ProjectLinksLoadStatus>
  projectLinksErrorByRepo: Record<string, string | undefined>
  fetchProjectLinks: (repoId: string) => Promise<void>
  saveProjectLink: (args: {
    repoId: string
    id?: string
    name: string
    url: string
    category: string
  }) => Promise<ProjectLink | null>
  removeProjectLink: (args: { repoId: string; linkId: string }) => Promise<void>
  reorderProjectLinks: (args: {
    repoId: string
    updates: { id: string; category: string; order: number }[]
  }) => Promise<void>
  /** Per-repo declared folder paths (categories that may have no links yet). */
  projectLinkFoldersByRepo: Record<string, string[]>
  fetchProjectLinkFolders: (repoId: string) => Promise<void>
  addProjectLinkFolder: (args: { repoId: string; path: string }) => Promise<void>
  removeProjectLinkFolder: (args: { repoId: string; path: string }) => Promise<void>
}

type ProjectLinksMaps = Pick<
  AppState,
  | 'projectLinksByRepo'
  | 'projectLinksLoadingByRepo'
  | 'projectLinksLoadStatusByRepo'
  | 'projectLinksErrorByRepo'
  | 'projectLinkFoldersByRepo'
>

// Why: four per-repo project-link maps are populated lazily per repo but
// never pruned when a repo is removed, so orphaned entries would accumulate for
// the renderer's whole session. Called from repo-removal reducers to drop
// entries for repos that no longer exist. Returns only the maps that changed so
// unrelated selectors don't re-run.
export function omitProjectLinksForRepos(
  s: ProjectLinksMaps,
  removedRepoIds: Iterable<string>
): Partial<AppState> {
  const removed = removedRepoIds instanceof Set ? removedRepoIds : new Set(removedRepoIds)
  if (removed.size === 0) {
    return {}
  }
  const omit = <T>(obj: Record<string, T>): Record<string, T> => {
    let changed = false
    const out = { ...obj }
    for (const id of removed) {
      if (id in out) {
        delete out[id]
        changed = true
      }
    }
    return changed ? out : obj
  }
  const result: Partial<AppState> = {}
  const byRepo = omit(s.projectLinksByRepo)
  if (byRepo !== s.projectLinksByRepo) {
    result.projectLinksByRepo = byRepo
  }
  const loading = omit(s.projectLinksLoadingByRepo)
  if (loading !== s.projectLinksLoadingByRepo) {
    result.projectLinksLoadingByRepo = loading
  }
  const status = omit(s.projectLinksLoadStatusByRepo)
  if (status !== s.projectLinksLoadStatusByRepo) {
    result.projectLinksLoadStatusByRepo = status
  }
  const error = omit(s.projectLinksErrorByRepo)
  if (error !== s.projectLinksErrorByRepo) {
    result.projectLinksErrorByRepo = error
  }
  const folders = omit(s.projectLinkFoldersByRepo)
  if (folders !== s.projectLinkFoldersByRepo) {
    result.projectLinkFoldersByRepo = folders
  }
  return result
}

export const createProjectLinksSlice: StateCreator<AppState, [], [], ProjectLinksSlice> = (
  set,
  get
) => ({
  projectLinksByRepo: {},
  projectLinksLoadingByRepo: {},
  projectLinksLoadStatusByRepo: {},
  projectLinksErrorByRepo: {},
  projectLinkFoldersByRepo: {},

  fetchProjectLinks: async (repoId) => {
    const state = get()
    if (state.projectLinksByRepo[repoId] !== undefined || state.projectLinksLoadingByRepo[repoId]) {
      return
    }
    set((s) => ({
      projectLinksLoadingByRepo: { ...s.projectLinksLoadingByRepo, [repoId]: true },
      projectLinksLoadStatusByRepo: { ...s.projectLinksLoadStatusByRepo, [repoId]: 'loading' },
      projectLinksErrorByRepo: { ...s.projectLinksErrorByRepo, [repoId]: undefined }
    }))
    try {
      const links = await window.api.projectLinks.list({ repoId })
      set((s) => ({
        projectLinksByRepo: { ...s.projectLinksByRepo, [repoId]: links },
        projectLinksLoadingByRepo: { ...s.projectLinksLoadingByRepo, [repoId]: false },
        projectLinksLoadStatusByRepo: { ...s.projectLinksLoadStatusByRepo, [repoId]: 'loaded' },
        projectLinksErrorByRepo: { ...s.projectLinksErrorByRepo, [repoId]: undefined }
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      set((s) => ({
        projectLinksLoadingByRepo: { ...s.projectLinksLoadingByRepo, [repoId]: false },
        projectLinksLoadStatusByRepo: { ...s.projectLinksLoadStatusByRepo, [repoId]: 'error' },
        projectLinksErrorByRepo: { ...s.projectLinksErrorByRepo, [repoId]: message }
      }))
      console.error(`Failed to fetch project links for repo ${repoId}:`, err)
    }
  },

  saveProjectLink: async (args) => {
    try {
      if (get().projectLinksByRepo[args.repoId] === undefined) {
        // Why: a saved link alone is not an authoritative repo bucket; load
        // existing links first so we do not hide them behind a one-item cache.
        await get().fetchProjectLinks(args.repoId)
        if (get().projectLinksByRepo[args.repoId] === undefined) {
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
      const saved = await window.api.projectLinks.save(args)
      set((s) => {
        const existing = s.projectLinksByRepo[args.repoId]
        if (existing === undefined) {
          return {}
        }
        const without = existing.filter((link) => link.id !== saved.id)
        return {
          projectLinksByRepo: {
            ...s.projectLinksByRepo,
            [args.repoId]: [...without, saved].sort(compareProjectLinks)
          }
        }
      })
      toast.success(
        args.id
          ? translate('auto.store.slices.project.links.updated', 'Link updated')
          : translate('auto.store.slices.project.links.saved', 'Link saved'),
        { description: saved.name }
      )
      return saved
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(
        args.id
          ? translate('auto.store.slices.project.links.updateFailed', 'Failed to update link')
          : translate('auto.store.slices.project.links.saveFailed', 'Failed to save link'),
        {
          description: message,
          duration: ERROR_TOAST_DURATION
        }
      )
      return null
    }
  },

  removeProjectLink: async ({ repoId, linkId }) => {
    const previous = get().projectLinksByRepo[repoId] ?? []
    // Why: optimistic local update keeps the menu responsive — toast handles the
    // failure path by restoring state.
    set((s) => ({
      projectLinksByRepo: {
        ...s.projectLinksByRepo,
        [repoId]: previous.filter((link) => link.id !== linkId)
      }
    }))
    try {
      await window.api.projectLinks.remove({ repoId, linkId })
      toast.success(translate('auto.store.slices.project.links.removed', 'Link removed'))
    } catch (err) {
      set((s) => ({
        projectLinksByRepo: { ...s.projectLinksByRepo, [repoId]: previous }
      }))
      const message = err instanceof Error ? err.message : String(err)
      toast.error(
        translate('auto.store.slices.project.links.removeFailed', 'Failed to remove link'),
        {
          description: message,
          duration: ERROR_TOAST_DURATION
        }
      )
      // Why: settings UI keeps confirmation/edit state until persistence succeeds.
      throw err
    }
  },

  reorderProjectLinks: async ({ repoId, updates }) => {
    const previous = get().projectLinksByRepo[repoId] ?? []
    const byId = new Map(updates.map((u) => [u.id, u]))
    // Why: optimistic local update — apply new category/order and re-sort so the
    // tree reflects the drag immediately; roll back on failure.
    set((s) => ({
      projectLinksByRepo: {
        ...s.projectLinksByRepo,
        [repoId]: [...previous]
          .map((link) => {
            const update = byId.get(link.id)
            return update ? { ...link, category: update.category, order: update.order } : link
          })
          .sort(compareProjectLinks)
      }
    }))
    try {
      await window.api.projectLinks.reorder({ repoId, updates })
    } catch (err) {
      set((s) => ({ projectLinksByRepo: { ...s.projectLinksByRepo, [repoId]: previous } }))
      const message = err instanceof Error ? err.message : String(err)
      toast.error(
        translate('auto.store.slices.project.links.reorderFailed', 'Failed to reorder links'),
        { description: message, duration: ERROR_TOAST_DURATION }
      )
      throw err
    }
  },

  fetchProjectLinkFolders: async (repoId) => {
    if (get().projectLinkFoldersByRepo[repoId] !== undefined) {
      return
    }
    try {
      const folders = await window.api.projectLinkFolders.list({ repoId })
      set((s) => ({
        projectLinkFoldersByRepo: { ...s.projectLinkFoldersByRepo, [repoId]: folders }
      }))
    } catch (err) {
      console.error(`Failed to fetch project link folders for repo ${repoId}:`, err)
    }
  },

  addProjectLinkFolder: async ({ repoId, path }) => {
    const previous = get().projectLinkFoldersByRepo[repoId] ?? []
    if (!previous.includes(path)) {
      set((s) => ({
        projectLinkFoldersByRepo: {
          ...s.projectLinkFoldersByRepo,
          [repoId]: [...previous, path].sort((left, right) => left.localeCompare(right))
        }
      }))
    }
    try {
      await window.api.projectLinkFolders.add({ repoId, path })
    } catch (err) {
      set((s) => ({
        projectLinkFoldersByRepo: { ...s.projectLinkFoldersByRepo, [repoId]: previous }
      }))
      const message = err instanceof Error ? err.message : String(err)
      toast.error(
        translate('auto.store.slices.project.links.folderAddFailed', 'Failed to add folder'),
        {
          description: message,
          duration: ERROR_TOAST_DURATION
        }
      )
      throw err
    }
  },

  removeProjectLinkFolder: async ({ repoId, path }) => {
    const previous = get().projectLinkFoldersByRepo[repoId] ?? []
    set((s) => ({
      projectLinkFoldersByRepo: {
        ...s.projectLinkFoldersByRepo,
        [repoId]: previous.filter((entry) => entry !== path)
      }
    }))
    try {
      await window.api.projectLinkFolders.remove({ repoId, path })
    } catch (err) {
      set((s) => ({
        projectLinkFoldersByRepo: { ...s.projectLinkFoldersByRepo, [repoId]: previous }
      }))
      const message = err instanceof Error ? err.message : String(err)
      toast.error(
        translate('auto.store.slices.project.links.folderRemoveFailed', 'Failed to remove folder'),
        { description: message, duration: ERROR_TOAST_DURATION }
      )
      throw err
    }
  }
})
