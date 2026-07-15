import { execFile, type ChildProcess } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { ipcMain } from 'electron'
import { endSubprocessStdin } from '../../shared/subprocess-stdin-write'
import type { PlantumlRenderArgs, PlantumlRenderResult } from '../../shared/types'

// Why: a complex diagram can take a few seconds to lay out under the JVM, but a
// runaway java process must not hang the render forever — kill and surface a
// timeout error the preview can fall back on.
const PLANTUML_TIMEOUT_MS = 20_000
// Why: SVG output for a large diagram can exceed the default 1MB execFile
// buffer; cap generously so real diagrams render but a pathological output
// cannot exhaust memory.
const PLANTUML_MAX_BUFFER = 16 * 1024 * 1024

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

  try {
    await access(jarPath, fsConstants.R_OK)
  } catch {
    return { error: `PlantUML jar not found or unreadable: ${jarPath}` }
  }

  return new Promise<PlantumlRenderResult>((resolve) => {
    let settled = false
    let timer: NodeJS.Timeout | null = null
    let child: ChildProcess | null = null

    const finish = (result: PlantumlRenderResult): void => {
      if (settled) {
        return
      }
      settled = true
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      resolve(result)
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
      child = execFile(
        'java',
        ['-Djava.awt.headless=true', '-jar', jarPath, '-tsvg', '-pipe', '-charset', 'UTF-8'],
        { encoding: 'utf8', maxBuffer: PLANTUML_MAX_BUFFER },
        (error, stdout, stderr) => {
          const svg = String(stdout).trim()
          if (svg.includes('<svg')) {
            finish({ svg })
            return
          }
          if (error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
            finish({
              error:
                'Java runtime not found. Install a JRE/JDK and make sure `java` is on your PATH.'
            })
            return
          }
          const detail = String(stderr || error?.message || '').trim()
          finish({ error: detail || 'PlantUML produced no diagram output.' })
        }
      )
    } catch (error) {
      finish({ error: error instanceof Error ? error.message : 'PlantUML rendering failed.' })
      return
    }

    child.once('error', (error) => {
      const code = (error as NodeJS.ErrnoException).code
      finish({
        error:
          code === 'ENOENT'
            ? 'Java runtime not found. Install a JRE/JDK and make sure `java` is on your PATH.'
            : error.message
      })
    })

    endSubprocessStdin(child.stdin, args.source)

    timer = setTimeout(() => {
      child?.kill()
      finish({ error: `PlantUML rendering timed out after ${PLANTUML_TIMEOUT_MS / 1000}s.` })
    }, PLANTUML_TIMEOUT_MS)
  })
}

export function registerPlantumlHandlers(): void {
  ipcMain.removeHandler('plantuml:render')
  ipcMain.handle('plantuml:render', (_event, args: PlantumlRenderArgs) => renderPlantuml(args))
}
