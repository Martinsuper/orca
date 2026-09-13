// Wire format for `projectLinks:export` / `projectLinks:import`. Kept in shared/
// so the main-process writer and the renderer's import UX validate against the
// same shape. Bump `PROJECT_LINKS_EXPORT_SCHEMA_VERSION` on any breaking
// change; the importer refuses higher versions rather than silently drop data.
export const PROJECT_LINKS_EXPORT_KIND = 'orca-project-links' as const
export const PROJECT_LINKS_EXPORT_SCHEMA_VERSION = 1 as const

export type ProjectLinksExportEnvelope = {
  kind: typeof PROJECT_LINKS_EXPORT_KIND
  schemaVersion: number
  /** Unix ms when the file was written; informational only. */
  exportedAt: number
  /** Name/url/category are the only user-authored fields carried across.
   *  ids and timestamps are re-minted on import so pastes into another
   *  profile do not collide with existing entries. */
  links: {
    name: string
    url: string
    category: string
    order?: number
  }[]
  /** Empty-folder declarations so a category with no links yet still lands. */
  folders: string[]
}
