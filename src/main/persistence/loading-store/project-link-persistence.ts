import type { ProjectLink } from '../../../shared/types'
import type { StoreRuntimeState } from './store-runtime-state'
import type { WriteSchedulingOperations } from './write-scheduling'
import { scheduleSave } from './write-scheduling'

type ProjectLinkRuntime = Pick<StoreRuntimeState, 'state'>
type ProjectLinkUpdate = { id: string; category: string; order: number }

const projectLinkPersistenceContext = Symbol('ProjectLinkPersistence')
type ProjectLinkPersistenceContext = {
  runtime: ProjectLinkRuntime
  scheduling: WriteSchedulingOperations
}

function sortLinks(links: readonly ProjectLink[]): ProjectLink[] {
  return [...links].sort((left, right) => {
    const orderDifference =
      (left.order ?? Number.POSITIVE_INFINITY) - (right.order ?? Number.POSITIVE_INFINITY)
    return orderDifference || left.name.localeCompare(right.name)
  })
}

export class ProjectLinkPersistence {
  readonly [projectLinkPersistenceContext]: ProjectLinkPersistenceContext

  constructor(runtime: ProjectLinkRuntime, scheduling: WriteSchedulingOperations) {
    this[projectLinkPersistenceContext] = { runtime, scheduling }
  }

  getProjectLinks(repoId: string): ProjectLink[] {
    return sortLinks(
      this[projectLinkPersistenceContext].runtime.state.projectLinksByRepo[repoId] ?? []
    )
  }

  saveProjectLink(link: ProjectLink): ProjectLink {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    const existing = runtime.state.projectLinksByRepo[link.repoId] ?? []
    const index = existing.findIndex((entry) => entry.id === link.id)
    runtime.state.projectLinksByRepo[link.repoId] =
      index === -1 ? [...existing, link] : existing.map((entry, i) => (i === index ? link : entry))
    scheduleSave(scheduling)
    return link
  }

  removeProjectLink(repoId: string, linkId: string): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    runtime.state.projectLinksByRepo[repoId] = (
      runtime.state.projectLinksByRepo[repoId] ?? []
    ).filter((entry) => entry.id !== linkId)
    scheduleSave(scheduling)
  }

  reorderProjectLinks(repoId: string, updates: ProjectLinkUpdate[]): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    const byId = new Map(updates.map((update) => [update.id, update]))
    runtime.state.projectLinksByRepo[repoId] = (runtime.state.projectLinksByRepo[repoId] ?? []).map(
      (link) => {
        const update = byId.get(link.id)
        return update ? { ...link, category: update.category, order: update.order } : link
      }
    )
    scheduleSave(scheduling)
  }

  getProjectLinkFolders(repoId: string): string[] {
    return [
      ...(this[projectLinkPersistenceContext].runtime.state.projectLinkFoldersByRepo[repoId] ?? [])
    ].sort()
  }

  addProjectLinkFolder(repoId: string, path: string): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    const existing = runtime.state.projectLinkFoldersByRepo[repoId] ?? []
    if (!existing.includes(path)) {
      runtime.state.projectLinkFoldersByRepo[repoId] = [...existing, path]
      scheduleSave(scheduling)
    }
  }

  removeProjectLinkFolder(repoId: string, path: string): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    runtime.state.projectLinkFoldersByRepo[repoId] = (
      runtime.state.projectLinkFoldersByRepo[repoId] ?? []
    ).filter((entry) => entry !== path)
    scheduleSave(scheduling)
  }

  getGlobalProjectLinks(): ProjectLink[] {
    return sortLinks(this[projectLinkPersistenceContext].runtime.state.globalProjectLinks ?? [])
  }

  saveGlobalProjectLink(link: ProjectLink): ProjectLink {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    const existing = runtime.state.globalProjectLinks ?? []
    const index = existing.findIndex((entry) => entry.id === link.id)
    runtime.state.globalProjectLinks =
      index === -1 ? [...existing, link] : existing.map((entry, i) => (i === index ? link : entry))
    scheduleSave(scheduling)
    return link
  }

  removeGlobalProjectLink(linkId: string): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    runtime.state.globalProjectLinks = (runtime.state.globalProjectLinks ?? []).filter(
      (entry) => entry.id !== linkId
    )
    scheduleSave(scheduling)
  }

  reorderGlobalProjectLinks(updates: ProjectLinkUpdate[]): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    const byId = new Map(updates.map((update) => [update.id, update]))
    runtime.state.globalProjectLinks = (runtime.state.globalProjectLinks ?? []).map((link) => {
      const update = byId.get(link.id)
      return update ? { ...link, category: update.category, order: update.order } : link
    })
    scheduleSave(scheduling)
  }

  getGlobalProjectLinkFolders(): string[] {
    return [
      ...(this[projectLinkPersistenceContext].runtime.state.globalProjectLinkFolders ?? [])
    ].sort()
  }

  addGlobalProjectLinkFolder(path: string): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    const existing = runtime.state.globalProjectLinkFolders ?? []
    if (!existing.includes(path)) {
      runtime.state.globalProjectLinkFolders = [...existing, path]
      scheduleSave(scheduling)
    }
  }

  removeGlobalProjectLinkFolder(path: string): void {
    const { runtime, scheduling } = this[projectLinkPersistenceContext]
    runtime.state.globalProjectLinkFolders = (runtime.state.globalProjectLinkFolders ?? []).filter(
      (entry) => entry !== path
    )
    scheduleSave(scheduling)
  }
}

export function installProjectLinkPersistenceContext(
  target: object,
  source: ProjectLinkPersistence
): void {
  Object.defineProperty(target, projectLinkPersistenceContext, {
    value: source[projectLinkPersistenceContext]
  })
}
