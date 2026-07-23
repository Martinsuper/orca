import type { ProjectLink } from '../../../../shared/types'

// Shared tree-building for project links. category is a single string; "/" is a
// UI convention for nesting (e.g. "prod/db"). Both the tab panel and any menu
// build the same tree from it, so this logic lives here rather than in a view.

export type LinkNode = {
  name: string
  path: string
  children: LinkNode[]
  links: ProjectLink[]
  /** True only for the top-level uncategorized bucket, whose links render inline. */
  flatten?: boolean
}

export const MAX_CATEGORY_DEPTH = 5

export function categorySegments(category: string, uncategorized: string): string[] {
  // Why: trim each segment, drop empties, and cap depth so a pathological value
  // can't build a runaway chain. An all-empty path falls back to the top group.
  const segments = category
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, MAX_CATEGORY_DEPTH)
  return segments.length > 0 ? segments : [uncategorized]
}

export function buildLinkTree(
  links: ProjectLink[],
  uncategorized: string,
  folders: string[] = []
): LinkNode[] {
  const roots: LinkNode[] = []
  const findOrCreate = (siblings: LinkNode[], name: string, path: string): LinkNode => {
    const existing = siblings.find((node) => node.name === name)
    if (existing) {
      return existing
    }
    const created: LinkNode = { name, path, children: [], links: [] }
    siblings.push(created)
    return created
  }

  const ensurePath = (segments: string[]): LinkNode | null => {
    let siblings = roots
    let node: LinkNode | null = null
    let path = ''
    for (const segment of segments) {
      path = path ? `${path}/${segment}` : segment
      node = findOrCreate(siblings, segment, path)
      siblings = node.children
    }
    return node
  }

  for (const link of links) {
    const node = ensurePath(categorySegments(link.category, uncategorized))
    node?.links.push(link)
  }

  // Why: declared folders may have no links yet; materialize their nodes so an
  // empty category still shows in the tree as a collapsible folder.
  for (const folder of folders) {
    const segments = folder
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .slice(0, MAX_CATEGORY_DEPTH)
    if (segments.length > 0) {
      ensurePath(segments)
    }
  }

  sortTree(roots)
  // Why: the top-level uncategorized bucket renders inline (no folder wrapper);
  // every real category — even single-level ones — stays a collapsible group.
  for (const node of roots) {
    if (node.name === uncategorized && node.children.length === 0) {
      node.flatten = true
    }
  }
  return roots
}

function sortTree(nodes: LinkNode[]): void {
  nodes.sort((left, right) => left.name.localeCompare(right.name))
  for (const node of nodes) {
    // Why: links honor manual order (missing sorts last, name tiebreak); folders
    // stay alphabetical since only links are drag-reorderable.
    node.links.sort((left, right) => {
      const leftOrder = left.order ?? Number.POSITIVE_INFINITY
      const rightOrder = right.order ?? Number.POSITIVE_INFINITY
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }
      return left.name.localeCompare(right.name)
    })
    sortTree(node.children)
  }
}

export function linkHost(rawUrl: string): string {
  // Why: the host is a compact hint of where a link goes; fall back to the raw
  // string when it isn't a parseable absolute URL.
  try {
    return new URL(rawUrl).host || rawUrl
  } catch {
    return rawUrl
  }
}

/** All node paths in the tree — used to seed "everything expanded" by default. */
export function collectNodePaths(nodes: LinkNode[]): string[] {
  const paths: string[] = []
  const walk = (list: LinkNode[]): void => {
    for (const node of list) {
      paths.push(node.path)
      walk(node.children)
    }
  }
  walk(nodes)
  return paths
}

/** Visible link ids in render order, honoring collapsed folders — the id list a
 *  SortableContext needs so drag indices line up with what the user sees. */
export function collectVisibleLinkIds(nodes: LinkNode[], collapsed: Set<string>): string[] {
  const ids: string[] = []
  const walk = (list: LinkNode[]): void => {
    for (const node of list) {
      const expanded = node.flatten || !collapsed.has(node.path)
      if (node.flatten) {
        for (const link of node.links) {
          ids.push(link.id)
        }
      } else if (expanded) {
        for (const link of node.links) {
          ids.push(link.id)
        }
        walk(node.children)
      }
    }
  }
  walk(nodes)
  return ids
}

function compareLinkOrder(left: ProjectLink, right: ProjectLink): number {
  const leftOrder = left.order ?? Number.POSITIVE_INFINITY
  const rightOrder = right.order ?? Number.POSITIVE_INFINITY
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }
  return left.name.localeCompare(right.name)
}

/** Pure reorder: move `draggedId` into `targetCategory` at `targetIndex`, then
 *  renumber that category's links 0..n. Returns only the changed links' updates
 *  (dragged link's category+order plus the target category's renumbering). */
export function computeLinkReorder(
  links: ProjectLink[],
  draggedId: string,
  targetCategory: string,
  targetIndex: number
): { id: string; category: string; order: number }[] {
  const dragged = links.find((link) => link.id === draggedId)
  if (!dragged) {
    return []
  }
  const inTarget = links
    .filter((link) => link.category === targetCategory && link.id !== draggedId)
    .sort(compareLinkOrder)
  const clamped = Math.max(0, Math.min(targetIndex, inTarget.length))
  inTarget.splice(clamped, 0, dragged)
  const updates: { id: string; category: string; order: number }[] = []
  inTarget.forEach((link, index) => {
    // Why: only emit a change when category or order actually differs, so a
    // no-op drag doesn't churn persistence.
    if (link.category !== targetCategory || link.order !== index) {
      updates.push({ id: link.id, category: targetCategory, order: index })
    }
  })
  return updates
}
