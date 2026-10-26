import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { ipcMain } from 'electron'
import { runProcess } from '@orca/process-host'
import type { PlantumlRenderArgs, PlantumlRenderResult } from '../../shared/types'
import { getCachedRender, renderCacheKey, setCachedRender } from './plantuml-render-cache'

// Why: a complex diagram can take a few seconds to lay out under the JVM, but a
// runaway java process must not hang the render forever — kill and surface a
// timeout error the preview can fall back on.
const PLANTUML_TIMEOUT_MS = 20_000
// Why: SVG output for a large diagram can exceed the default 1MB output
// buffer; cap generously so real diagrams render but a pathological output
// cannot exhaust memory.
const PLANTUML_MAX_BUFFER = 16 * 1024 * 1024

const JAVA_MISSING_ERROR =
  'Java runtime not found. Install a JRE/JDK and make sure `java` is on your PATH.'

/**
 * Renders PlantUML source to SVG by piping it through the user's local
 * plantuml.jar (`java -jar <jar> -tsvg -pipe`). Source stays on the machine —
 * unlike the public PlantUML server, nothing is sent over the network.
 *
 * Never throws: returns a structured error so the preview can show a fallback
 * instead of breaking the whole document.
 */
async function renderPlantuml(args: PlantumlRenderArgs): Promise<PlantumlRenderResult> {
  const jarPath = args.jarPath.trim()
  if (jarPath === '') {
    return { error: 'PlantUML jar path is not configured.' }
  }

  const cacheKey = renderCacheKey(jarPath, args.source)
  const cachedSvg = getCachedRender(cacheKey)
  if (cachedSvg !== undefined) {
    return { svg: cachedSvg }
  }

  try {
    await access(jarPath, fsConstants.R_OK)
  } catch {
    return { error: `PlantUML jar not found or unreadable: ${jarPath}` }
  }

  try {
    // Why: -tsvg emits SVG; -pipe reads source from stdin and writes the
    // diagram to stdout, so no temp files touch disk. On a syntax error
    // PlantUML still emits an SVG that visualizes the error (with line marker),
    // which is more useful to the user than a bare message — so we prefer any
    // <svg> in stdout over the non-zero exit code, and only fall back to the
    // stderr text when no diagram was produced at all (missing java, crash).
    //
    // -Djava.awt.headless=true MUST come before -jar (it is a JVM option, not a
    // PlantUML arg): PlantUML uses AWT to lay out diagrams, and without headless
    // mode macOS pops a Java GUI app in the Dock on every render.
    const result = await runProcess({
      program: 'java',
      args: ['-Djava.awt.headless=true', '-jar', jarPath, '-tsvg', '-pipe', '-charset', 'UTF-8'],
      input: args.source,
      timeoutMs: PLANTUML_TIMEOUT_MS,
      maxOutputBytes: PLANTUML_MAX_BUFFER
    })
    if (result.timedOut) {
      return { error: `PlantUML rendering timed out after ${PLANTUML_TIMEOUT_MS / 1000}s.` }
    }
    const svg = result.stdout.trim()
    if (svg.includes('<svg')) {
      setCachedRender(cacheKey, svg)
      return { svg }
    }
    return { error: result.stderr.trim() || 'PlantUML produced no diagram output.' }
  } catch (error) {
    return {
      error:
        (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? JAVA_MISSING_ERROR
          : error instanceof Error
            ? error.message
            : 'PlantUML rendering failed.'
    }
  }
}

export function registerPlantumlHandlers(): void {
  ipcMain.removeHandler('plantuml:render')
  ipcMain.handle('plantuml:render', (_event, args: PlantumlRenderArgs) => renderPlantuml(args))
}
