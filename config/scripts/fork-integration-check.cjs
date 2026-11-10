// Guards fork-only integrations against being dropped by upstream merges.
// Run after any rebase/merge (pnpm check:fork-integrations): fails with a list
// of missing guard points when a refactor or merge resolution deleted them.
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const repoRoot = join(__dirname, '..', '..')

/** (existingFilePart, marker/raw, reason) — file must exist; when raw is false the file must contain the marker. */
const contracts = [
  {
    file: 'src/renderer/src/components/editor/PlantUmlBlock.tsx',
    marker: 'window.api.plantuml',
    raw: false,
    why: 'fork feature: local plantuml.jar rendering'
  },
  {
    file: 'src/renderer/src/components/editor/markdown-preview/render-tree/use-markdown-preview-components.tsx',
    marker: 'language-plantuml',
    raw: false,
    why: 'markdown preview renders ```plantuml fences'
  },
  {
    file: 'src/renderer/src/components/sidebar/comment-markdown-code-renderers.tsx',
    marker: 'isPlantumlFence',
    raw: false,
    why: 'sidebar comments render ```plantuml fences'
  },
  {
    file: 'src/preload/api-types.ts',
    marker: 'plantuml',
    raw: false,
    why: 'preload api contract'
  },
  {
    file: 'src/preload/index.ts',
    marker: 'plantumlApi',
    raw: false,
    why: 'preload wiring'
  },
  {
    file: 'src/main/ipc/register-core-handlers/register-core-handlers.ts',
    marker: 'registerPlantumlHandlers',
    raw: false,
    why: 'main-process handler registration'
  },
  {
    file: 'src/shared/global-settings-types.ts',
    marker: 'plantumlJarPath',
    raw: false,
    why: 'settings persistence'
  },
  {
    file: 'src/main/ipc/shell.ts',
    marker: 'pickJarFile',
    raw: false,
    why: 'settings jar picker'
  },
  {
    file: 'src/renderer/src/components/settings/editor/GeneralEditorSettingsSection.tsx',
    marker: 'PlantumlJarPathSetting',
    raw: false,
    why: 'settings UI entry'
  },
  {
    file: 'src/renderer/src/components/right-sidebar/todo-view-filters.ts',
    marker: 'dueDate',
    raw: false,
    why: 'fork feature: todo filters'
  },
  {
    file: 'src/renderer/src/components/right-sidebar/ProjectLinksManagerList.tsx',
    marker: 'category',
    raw: false,
    why: 'fork feature: project links'
  }
]

const failures = []
for (const { file, marker, raw, why } of contracts) {
  const path = join(repoRoot, file)
  if (!existsSync(path)) {
    failures.push(`MISSING FILE ${file} (${why})`)
    continue
  }
  if (!raw && marker && !readFileSync(path, 'utf8').includes(marker)) {
    failures.push(`MISSING WIRING ${file} does not contain ${JSON.stringify(marker)} (${why})`)
  }
}

if (failures.length > 0) {
  console.error(`[check:fork-integrations] ${failures.length} fork integration(s) broken:`)
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  process.exit(1)
}
console.log('[check:fork-integrations] OK — all fork integrations intact')
