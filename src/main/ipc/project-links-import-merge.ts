import type { ProjectLink } from '../../shared/types'
import type { ProjectLinksExportEnvelope } from '../../shared/project-links-export'
import {
  PROJECT_LINKS_EXPORT_KIND,
  PROJECT_LINKS_EXPORT_SCHEMA_VERSION
} from '../../shared/project-links-export'
import {
  normalizeProjectLinkCategory,
  normalizeProjectLinkName,
  normalizeProjectLinkUrl
} from './project-link-normalization'

export type ParsedImportPayload = {
  links: { name: string; url: string; category: string; order?: number }[]
  folders: string[]
}

// Pure parse: validate the envelope shape and coerce entries through the same
// normalizers a manual save would use, so a hand-edited or foreign file can't
// bypass URL/name/category rules. Throws with a user-visible message on any
// structural or semantic issue.
export function parseProjectLinksExport(raw: unknown): ParsedImportPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid file: not a JSON object.')
  }
  const envelope = raw as Partial<ProjectLinksExportEnvelope>
  if (envelope.kind !== PROJECT_LINKS_EXPORT_KIND) {
    throw new Error('Invalid file: not an Orca project-links export.')
  }
  if (typeof envelope.schemaVersion !== 'number') {
    throw new Error('Invalid file: schemaVersion missing.')
  }
  // Why: refuse a newer file rather than drop fields; users get a clear "update
  // Orca to import this" signal instead of a silent partial import.
  if (envelope.schemaVersion > PROJECT_LINKS_EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported export version ${envelope.schemaVersion}. Update Orca to import this file.`
    )
  }
  const rawLinks = Array.isArray(envelope.links) ? envelope.links : []
  const links: ParsedImportPayload['links'] = []
  for (const entry of rawLinks) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    try {
      const name = normalizeProjectLinkName(String((entry as { name?: unknown }).name ?? ''))
      const url = normalizeProjectLinkUrl(String((entry as { url?: unknown }).url ?? ''))
      const category = normalizeProjectLinkCategory(
        String((entry as { category?: unknown }).category ?? '')
      )
      const rawOrder = (entry as { order?: unknown }).order
      const order = typeof rawOrder === 'number' && Number.isFinite(rawOrder) ? rawOrder : undefined
      links.push({ name, url, category, ...(order !== undefined ? { order } : {}) })
    } catch {
      // Why: skip malformed entries rather than fail the whole import — a
      // single bad row shouldn't lose everything else in the file.
    }
  }
  const rawFolders = Array.isArray(envelope.folders) ? envelope.folders : []
  const folders = rawFolders
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  return { links, folders }
}

export type MergeCandidate = { name: string; url: string; category: string; order?: number }
export type MergeResult = {
  toInsert: MergeCandidate[]
  skipped: number
  duplicatesInFile: number
}

// Merge-skip: for each incoming link, drop entries whose (url, category) pair
// already exists in `existing`. Also dedupe within the incoming batch so an
// export that itself contains duplicates doesn't compound them.
export function mergeSkipDuplicates(
  existing: readonly ProjectLink[],
  incoming: readonly MergeCandidate[]
): MergeResult {
  const key = (url: string, category: string): string => `${url}\u001f${category.trim()}`
  const seen = new Set<string>()
  for (const link of existing) {
    seen.add(key(link.url, link.category))
  }
  const toInsert: MergeCandidate[] = []
  let skipped = 0
  let duplicatesInFile = 0
  for (const entry of incoming) {
    const entryKey = key(entry.url, entry.category)
    if (seen.has(entryKey)) {
      // Why: distinguish "already had this before" from "the file itself lists
      // this twice" so the toast can say something useful; both count as skip
      // to the caller though.
      if (toInsert.some((pending) => key(pending.url, pending.category) === entryKey)) {
        duplicatesInFile++
      } else {
        skipped++
      }
      continue
    }
    seen.add(entryKey)
    toInsert.push(entry)
  }
  return { toInsert, skipped, duplicatesInFile }
}

export function mergeFoldersSkipDuplicates(
  existing: readonly string[],
  incoming: readonly string[]
): { toInsert: string[]; skipped: number } {
  const set = new Set(existing)
  const toInsert: string[] = []
  let skipped = 0
  for (const path of incoming) {
    if (set.has(path)) {
      skipped++
      continue
    }
    set.add(path)
    toInsert.push(path)
  }
  return { toInsert, skipped }
}
