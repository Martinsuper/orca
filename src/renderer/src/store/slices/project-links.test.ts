import { create } from 'zustand'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectLink } from '../../../../shared/types'
import type { AppState } from '../types'
import { createProjectLinksSlice } from './project-links'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mockApi = {
  projectLinks: {
    list: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn()
  },
  projectLinkFolders: {
    list: vi.fn(),
    add: vi.fn(),
    remove: vi.fn()
  }
}

// @ts-expect-error -- test shim
globalThis.window = { api: mockApi }

function createTestStore() {
  return create<AppState>()((...a) => ({ ...createProjectLinksSlice(...a) }) as AppState)
}

function makeLink(overrides: Partial<ProjectLink> & { id: string; repoId: string }): ProjectLink {
  return {
    name: overrides.id,
    url: 'https://example.com',
    category: 'Production',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('createProjectLinksSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.projectLinks.list.mockResolvedValue([])
    mockApi.projectLinks.save.mockImplementation((args: Partial<ProjectLink>) =>
      Promise.resolve(
        makeLink({
          id: args.id ?? `link-${args.name}`,
          repoId: args.repoId ?? 'repo-1',
          name: args.name ?? 'Link',
          url: args.url ?? 'https://example.com',
          category: args.category ?? 'Production',
          updatedAt: 2
        })
      )
    )
    mockApi.projectLinks.remove.mockResolvedValue(undefined)
    mockApi.projectLinks.reorder.mockResolvedValue(undefined)
    mockApi.projectLinkFolders.list.mockResolvedValue([])
    mockApi.projectLinkFolders.add.mockResolvedValue(undefined)
    mockApi.projectLinkFolders.remove.mockResolvedValue(undefined)
  })

  it('fetches links into the requested repo bucket', async () => {
    const store = createTestStore()
    const link = makeLink({ id: 'link-1', repoId: 'repo-1', name: 'Docs' })
    mockApi.projectLinks.list.mockResolvedValueOnce([link])

    await store.getState().fetchProjectLinks('repo-1')

    expect(mockApi.projectLinks.list).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(store.getState().projectLinksByRepo).toEqual({ 'repo-1': [link] })
    expect(store.getState().projectLinksLoadingByRepo['repo-1']).toBe(false)
    expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('loaded')
    expect(store.getState().projectLinksErrorByRepo['repo-1']).toBeUndefined()
  })

  it('keeps an unfetched repo bucket missing while links are loading', async () => {
    const store = createTestStore()
    const link = makeLink({ id: 'link-1', repoId: 'repo-1', name: 'Docs' })
    let resolveList: (links: ProjectLink[]) => void = () => {}
    mockApi.projectLinks.list.mockReturnValueOnce(
      new Promise<ProjectLink[]>((resolve) => {
        resolveList = resolve
      })
    )

    const fetchPromise = store.getState().fetchProjectLinks('repo-1')

    expect(store.getState().projectLinksByRepo['repo-1']).toBeUndefined()
    expect(store.getState().projectLinksLoadingByRepo['repo-1']).toBe(true)
    expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('loading')

    resolveList([link])
    await fetchPromise

    expect(store.getState().projectLinksByRepo['repo-1']).toEqual([link])
    expect(store.getState().projectLinksLoadingByRepo['repo-1']).toBe(false)
    expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('loaded')
  })

  it('does not refetch while a repo bucket is loading or already loaded', async () => {
    const store = createTestStore()
    let resolveList: (links: ProjectLink[]) => void = () => {}
    mockApi.projectLinks.list.mockReturnValueOnce(
      new Promise<ProjectLink[]>((resolve) => {
        resolveList = resolve
      })
    )

    const fetchPromise = store.getState().fetchProjectLinks('repo-1')
    await store.getState().fetchProjectLinks('repo-1')

    expect(mockApi.projectLinks.list).toHaveBeenCalledTimes(1)

    resolveList([])
    await fetchPromise
    await store.getState().fetchProjectLinks('repo-1')

    expect(mockApi.projectLinks.list).toHaveBeenCalledTimes(1)
  })

  it('clears loading state without marking the repo loaded when fetch fails', async () => {
    const store = createTestStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi.projectLinks.list.mockRejectedValueOnce(new Error('disk failed'))

    try {
      await store.getState().fetchProjectLinks('repo-1')

      expect(store.getState().projectLinksByRepo['repo-1']).toBeUndefined()
      expect(store.getState().projectLinksLoadingByRepo['repo-1']).toBe(false)
      expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('error')
      expect(store.getState().projectLinksErrorByRepo['repo-1']).toBe('disk failed')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('clears a failed fetch status when retrying links succeeds', async () => {
    const store = createTestStore()
    const link = makeLink({ id: 'link-1', repoId: 'repo-1', name: 'Docs' })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi.projectLinks.list
      .mockRejectedValueOnce(new Error('disk failed'))
      .mockResolvedValueOnce([link])

    try {
      await store.getState().fetchProjectLinks('repo-1')
      await store.getState().fetchProjectLinks('repo-1')

      expect(mockApi.projectLinks.list).toHaveBeenCalledTimes(2)
      expect(store.getState().projectLinksByRepo['repo-1']).toEqual([link])
      expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('loaded')
      expect(store.getState().projectLinksErrorByRepo['repo-1']).toBeUndefined()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('saves links per repo and sorts the repo list by name', async () => {
    const store = createTestStore()
    store.setState({
      projectLinksByRepo: {
        'repo-1': [makeLink({ id: 'z', repoId: 'repo-1', name: 'Zed' })],
        'repo-2': [makeLink({ id: 'other', repoId: 'repo-2', name: 'Other' })]
      }
    } as Partial<AppState>)

    const saved = await store.getState().saveProjectLink({
      repoId: 'repo-1',
      name: 'Api',
      url: 'https://api.example.com',
      category: 'Production'
    })

    expect(saved?.name).toBe('Api')
    expect(store.getState().projectLinksByRepo['repo-1'].map((link) => link.name)).toEqual([
      'Api',
      'Zed'
    ])
    expect(store.getState().projectLinksByRepo['repo-2'].map((link) => link.name)).toEqual([
      'Other'
    ])
  })

  it('loads an unfetched repo bucket before saving so existing links stay visible', async () => {
    const store = createTestStore()
    const existing = makeLink({ id: 'existing', repoId: 'repo-1', name: 'Existing' })
    mockApi.projectLinks.list.mockResolvedValueOnce([existing])

    const saved = await store.getState().saveProjectLink({
      repoId: 'repo-1',
      name: 'Api',
      url: 'https://api.example.com',
      category: 'Production'
    })

    expect(mockApi.projectLinks.list).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(mockApi.projectLinks.save).toHaveBeenCalledTimes(1)
    expect(saved?.name).toBe('Api')
    expect(store.getState().projectLinksByRepo['repo-1'].map((link) => link.name)).toEqual([
      'Api',
      'Existing'
    ])
    expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('loaded')
  })

  it('does not save or synthesize a repo bucket when links fail to load first', async () => {
    const store = createTestStore()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi.projectLinks.list.mockRejectedValueOnce(new Error('disk failed'))

    try {
      const saved = await store.getState().saveProjectLink({
        repoId: 'repo-1',
        name: 'Api',
        url: 'https://api.example.com',
        category: 'Production'
      })

      expect(saved).toBeNull()
      expect(mockApi.projectLinks.save).not.toHaveBeenCalled()
      expect(store.getState().projectLinksByRepo['repo-1']).toBeUndefined()
      expect(store.getState().projectLinksLoadStatusByRepo['repo-1']).toBe('error')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('restores the previous repo links when remove fails', async () => {
    const store = createTestStore()
    const link = makeLink({ id: 'link-1', repoId: 'repo-1', name: 'Docs' })
    mockApi.projectLinks.remove.mockRejectedValueOnce(new Error('disk failed'))
    store.setState({ projectLinksByRepo: { 'repo-1': [link] } } as Partial<AppState>)

    await expect(
      store.getState().removeProjectLink({ repoId: 'repo-1', linkId: 'link-1' })
    ).rejects.toThrow('disk failed')

    expect(store.getState().projectLinksByRepo['repo-1']).toEqual([link])
  })

  it('optimistically removes a link before persistence resolves', async () => {
    const store = createTestStore()
    const link = makeLink({ id: 'link-1', repoId: 'repo-1', name: 'Docs' })
    store.setState({ projectLinksByRepo: { 'repo-1': [link] } } as Partial<AppState>)

    await store.getState().removeProjectLink({ repoId: 'repo-1', linkId: 'link-1' })

    expect(mockApi.projectLinks.remove).toHaveBeenCalledWith({ repoId: 'repo-1', linkId: 'link-1' })
    expect(store.getState().projectLinksByRepo['repo-1']).toEqual([])
  })

  it('fetches folders into the requested repo bucket', async () => {
    const store = createTestStore()
    mockApi.projectLinkFolders.list.mockResolvedValueOnce(['生产/数据库'])

    await store.getState().fetchProjectLinkFolders('repo-1')

    expect(mockApi.projectLinkFolders.list).toHaveBeenCalledWith({ repoId: 'repo-1' })
    expect(store.getState().projectLinkFoldersByRepo['repo-1']).toEqual(['生产/数据库'])
  })

  it('optimistically adds a folder, sorted and de-duplicated', async () => {
    const store = createTestStore()
    store.setState({ projectLinkFoldersByRepo: { 'repo-1': ['b-cat'] } } as Partial<AppState>)

    await store.getState().addProjectLinkFolder({ repoId: 'repo-1', path: 'a-cat' })

    expect(mockApi.projectLinkFolders.add).toHaveBeenCalledWith({ repoId: 'repo-1', path: 'a-cat' })
    expect(store.getState().projectLinkFoldersByRepo['repo-1']).toEqual(['a-cat', 'b-cat'])
  })

  it('restores folders when add fails', async () => {
    const store = createTestStore()
    mockApi.projectLinkFolders.add.mockRejectedValueOnce(new Error('disk failed'))
    store.setState({ projectLinkFoldersByRepo: { 'repo-1': ['测试'] } } as Partial<AppState>)

    await expect(
      store.getState().addProjectLinkFolder({ repoId: 'repo-1', path: '部署' })
    ).rejects.toThrow('disk failed')

    expect(store.getState().projectLinkFoldersByRepo['repo-1']).toEqual(['测试'])
  })

  it('optimistically removes a folder', async () => {
    const store = createTestStore()
    store.setState({
      projectLinkFoldersByRepo: { 'repo-1': ['部署', '测试'] }
    } as Partial<AppState>)

    await store.getState().removeProjectLinkFolder({ repoId: 'repo-1', path: '部署' })

    expect(mockApi.projectLinkFolders.remove).toHaveBeenCalledWith({
      repoId: 'repo-1',
      path: '部署'
    })
    expect(store.getState().projectLinkFoldersByRepo['repo-1']).toEqual(['测试'])
  })

  it('optimistically applies reorder updates (category + order) and re-sorts', async () => {
    const store = createTestStore()
    store.setState({
      projectLinksByRepo: {
        'repo-1': [
          makeLink({ id: 'a', repoId: 'repo-1', name: 'A', category: 'P', order: 0 }),
          makeLink({ id: 'b', repoId: 'repo-1', name: 'B', category: 'P', order: 1 })
        ]
      }
    } as Partial<AppState>)

    await store.getState().reorderProjectLinks({
      repoId: 'repo-1',
      updates: [
        { id: 'b', category: 'P', order: 0 },
        { id: 'a', category: 'P', order: 1 }
      ]
    })

    expect(mockApi.projectLinks.reorder).toHaveBeenCalledWith({
      repoId: 'repo-1',
      updates: [
        { id: 'b', category: 'P', order: 0 },
        { id: 'a', category: 'P', order: 1 }
      ]
    })
    expect(store.getState().projectLinksByRepo['repo-1'].map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('restores links when reorder fails', async () => {
    const store = createTestStore()
    mockApi.projectLinks.reorder.mockRejectedValueOnce(new Error('disk failed'))
    const original = [
      makeLink({ id: 'a', repoId: 'repo-1', name: 'A', category: 'P', order: 0 }),
      makeLink({ id: 'b', repoId: 'repo-1', name: 'B', category: 'P', order: 1 })
    ]
    store.setState({ projectLinksByRepo: { 'repo-1': original } } as Partial<AppState>)

    await expect(
      store.getState().reorderProjectLinks({
        repoId: 'repo-1',
        updates: [{ id: 'b', category: 'Q', order: 0 }]
      })
    ).rejects.toThrow('disk failed')

    expect(store.getState().projectLinksByRepo['repo-1']).toEqual(original)
  })
})
