import { describe, expect, it } from 'vitest'
import { buildLinkTree, computeLinkReorder } from './project-links-tree'
import type { ProjectLink } from '../../../../shared/types'

const UNCATEGORIZED = 'Uncategorized'

function makeLink(overrides: Partial<ProjectLink> & { id: string; category: string }): ProjectLink {
  return {
    repoId: 'repo-1',
    name: overrides.id,
    url: 'https://example.com',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

describe('buildLinkTree', () => {
  it('nests links by "/"-separated category', () => {
    const tree = buildLinkTree(
      [
        makeLink({ id: 'a', category: '生产/数据库', name: 'DB' }),
        makeLink({ id: 'b', category: '生产/后台', name: 'Admin' })
      ],
      UNCATEGORIZED
    )
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('生产')
    expect(tree[0].children.map((c) => c.name)).toEqual(['后台', '数据库'])
  })

  it('flattens the top-level uncategorized bucket', () => {
    const tree = buildLinkTree([makeLink({ id: 'a', category: '', name: 'Wiki' })], UNCATEGORIZED)
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe(UNCATEGORIZED)
    expect(tree[0].flatten).toBe(true)
    expect(tree[0].links.map((l) => l.id)).toEqual(['a'])
  })

  it('materializes empty declared folders with no links', () => {
    const tree = buildLinkTree([], UNCATEGORIZED, ['部署'])
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('部署')
    expect(tree[0].links).toEqual([])
    expect(tree[0].children).toEqual([])
    expect(tree[0].flatten).toBeUndefined()
  })

  it('merges an empty subfolder into a category that also has links', () => {
    const tree = buildLinkTree(
      [makeLink({ id: 'a', category: '生产', name: 'Home' })],
      UNCATEGORIZED,
      ['生产/监控']
    )
    const prod = tree.find((n) => n.name === '生产')
    expect(prod).toBeDefined()
    expect(prod?.links.map((l) => l.id)).toEqual(['a'])
    expect(prod?.children.map((c) => c.name)).toEqual(['监控'])
  })

  it('does not duplicate a folder already implied by a link', () => {
    const tree = buildLinkTree(
      [makeLink({ id: 'a', category: '生产/数据库', name: 'DB' })],
      UNCATEGORIZED,
      ['生产/数据库']
    )
    expect(tree).toHaveLength(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].links.map((l) => l.id)).toEqual(['a'])
  })
})

describe('computeLinkReorder', () => {
  const links: ProjectLink[] = [
    makeLink({ id: 'a', category: '生产', name: 'A', order: 0 }),
    makeLink({ id: 'b', category: '生产', name: 'B', order: 1 }),
    makeLink({ id: 'c', category: '生产', name: 'C', order: 2 }),
    makeLink({ id: 'x', category: '测试', name: 'X', order: 0 })
  ]

  it('reorders within the same category and renumbers', () => {
    // Move 'c' to index 0 within 生产 → c,a,b
    const updates = computeLinkReorder(links, 'c', '生产', 0)
    const byId = new Map(updates.map((u) => [u.id, u.order]))
    expect(byId.get('c')).toBe(0)
    expect(byId.get('a')).toBe(1)
    expect(byId.get('b')).toBe(2)
    expect(updates.every((u) => u.category === '生产')).toBe(true)
  })

  it('moves a link into another category', () => {
    // Move 'a' into 测试 at index 1 (after x)
    const updates = computeLinkReorder(links, 'a', '测试', 1)
    const a = updates.find((u) => u.id === 'a')
    expect(a).toEqual({ id: 'a', category: '测试', order: 1 })
  })

  it('moves a link to top level (empty category)', () => {
    const updates = computeLinkReorder(links, 'a', '', 0)
    const a = updates.find((u) => u.id === 'a')
    expect(a).toEqual({ id: 'a', category: '', order: 0 })
  })

  it('returns no updates for an unknown link', () => {
    expect(computeLinkReorder(links, 'missing', '生产', 0)).toEqual([])
  })

  it('clamps an out-of-range index to the end', () => {
    const updates = computeLinkReorder(links, 'x', '生产', 999)
    const x = updates.find((u) => u.id === 'x')
    expect(x).toEqual({ id: 'x', category: '生产', order: 3 })
  })
})
