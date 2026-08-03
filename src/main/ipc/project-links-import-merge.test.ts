import { describe, it, expect } from 'vitest'
import {
  mergeFoldersSkipDuplicates,
  mergeSkipDuplicates,
  parseProjectLinksExport
} from './project-links-import-merge'
import {
  PROJECT_LINKS_EXPORT_KIND,
  PROJECT_LINKS_EXPORT_SCHEMA_VERSION
} from '../../shared/project-links-export'
import type { ProjectLink } from '../../shared/types'

const link = (overrides: Partial<ProjectLink>): ProjectLink => ({
  id: overrides.id ?? 'x',
  repoId: overrides.repoId ?? 'r1',
  name: overrides.name ?? 'Name',
  url: overrides.url ?? 'https://example.com/',
  category: overrides.category ?? '',
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  ...(overrides.order !== undefined ? { order: overrides.order } : {})
})

describe('parseProjectLinksExport', () => {
  it('accepts a valid envelope and normalizes entries', () => {
    const parsed = parseProjectLinksExport({
      kind: PROJECT_LINKS_EXPORT_KIND,
      schemaVersion: PROJECT_LINKS_EXPORT_SCHEMA_VERSION,
      exportedAt: 1,
      links: [{ name: 'A', url: 'example.com', category: 'prod' }],
      folders: ['prod', ' ', '']
    })
    expect(parsed.links).toEqual([{ name: 'A', url: 'https://example.com/', category: 'prod' }])
    expect(parsed.folders).toEqual(['prod'])
  })

  it('rejects non-envelope inputs', () => {
    expect(() => parseProjectLinksExport(null)).toThrow(/JSON object/)
    expect(() => parseProjectLinksExport({ kind: 'other' })).toThrow(/Orca project-links/)
    expect(() =>
      parseProjectLinksExport({ kind: PROJECT_LINKS_EXPORT_KIND, schemaVersion: 'x' })
    ).toThrow(/schemaVersion/)
  })

  it('refuses newer schema versions', () => {
    expect(() =>
      parseProjectLinksExport({
        kind: PROJECT_LINKS_EXPORT_KIND,
        schemaVersion: PROJECT_LINKS_EXPORT_SCHEMA_VERSION + 1,
        exportedAt: 1,
        links: [],
        folders: []
      })
    ).toThrow(/Unsupported export version/)
  })

  it('drops malformed entries but keeps valid siblings', () => {
    const parsed = parseProjectLinksExport({
      kind: PROJECT_LINKS_EXPORT_KIND,
      schemaVersion: 1,
      exportedAt: 1,
      links: [
        { name: '', url: 'https://a', category: '' }, // blank name → skipped
        { name: 'Bad', url: 'javascript:alert(1)', category: '' }, // bad protocol → skipped
        { name: 'Good', url: 'https://good.example.com', category: 'ops' }
      ],
      folders: []
    })
    expect(parsed.links).toEqual([
      { name: 'Good', url: 'https://good.example.com/', category: 'ops' }
    ])
  })
})

describe('mergeSkipDuplicates', () => {
  it('skips entries whose (url, category) already exists', () => {
    const existing = [link({ id: '1', url: 'https://a.com/', category: 'ops' })]
    const incoming = [
      { name: 'A', url: 'https://a.com/', category: 'ops' },
      { name: 'B', url: 'https://b.com/', category: 'ops' }
    ]
    const result = mergeSkipDuplicates(existing, incoming)
    expect(result.toInsert).toEqual([{ name: 'B', url: 'https://b.com/', category: 'ops' }])
    expect(result.skipped).toBe(1)
    expect(result.duplicatesInFile).toBe(0)
  })

  it('treats same URL under different categories as distinct', () => {
    const existing = [link({ id: '1', url: 'https://a.com/', category: 'ops' })]
    const result = mergeSkipDuplicates(existing, [
      { name: 'A', url: 'https://a.com/', category: 'dev' }
    ])
    expect(result.toInsert).toHaveLength(1)
    expect(result.skipped).toBe(0)
  })

  it('collapses duplicates present within the incoming file itself', () => {
    const result = mergeSkipDuplicates(
      [],
      [
        { name: 'A', url: 'https://a.com/', category: 'ops' },
        { name: 'A2', url: 'https://a.com/', category: 'ops' }
      ]
    )
    expect(result.toInsert).toHaveLength(1)
    expect(result.duplicatesInFile).toBe(1)
  })
})

describe('mergeFoldersSkipDuplicates', () => {
  it('skips folders that already exist', () => {
    const result = mergeFoldersSkipDuplicates(['ops'], ['ops', 'dev'])
    expect(result.toInsert).toEqual(['dev'])
    expect(result.skipped).toBe(1)
  })
})
