import React, { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'

type PlantUmlBlockProps = {
  content: string
}

type RenderState =
  | { status: 'loading' }
  | { status: 'ready'; html: string }
  | { status: 'error'; message: string }

// Why: PlantUML emits <svg> with fixed pixel width/height AND
// preserveAspectRatio="none". Injected as-is, the diagram stretches: when the
// container is narrower than the fixed width the browser squeezes width while
// the inline height stays, and "none" lets it distort instead of scaling
// uniformly. Dropping the inline size + aspect-ratio override (keeping viewBox)
// lets CSS size it responsively with correct proportions.
function normalizeDiagramSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = doc.documentElement
  if (root.nodeName.toLowerCase() !== 'svg') {
    return svg
  }
  root.removeAttribute('width')
  root.removeAttribute('height')
  root.removeAttribute('preserveAspectRatio')
  root.removeAttribute('style')
  return new XMLSerializer().serializeToString(root)
}

/**
 * Renders a PlantUML diagram by piping the source through the user's local
 * plantuml.jar via IPC (`java -jar <jar> -tsvg -pipe`) and injecting the
 * sanitized SVG. Falls back to the raw source with a hint when no jar is
 * configured or rendering fails — never breaks the rest of the preview.
 *
 * Unlike Mermaid (pure-JS, in-renderer), PlantUML has no browser renderer, so
 * it depends on a local jar. Keeping it local means diagram source never leaves
 * the machine — no public PlantUML server is contacted.
 *
 * Why the SVG lives in state (not imperative innerHTML): rendering through
 * state means the success branch always mounts the diagram element, so
 * recovering from an error back to a valid diagram works without a ref-timing
 * race.
 */
export default function PlantUmlBlock({ content }: PlantUmlBlockProps): React.JSX.Element {
  const jarPath = useAppStore((s) => s.settings?.plantumlJarPath ?? '')
  const [state, setState] = useState<RenderState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    if (jarPath.trim() === '') {
      setState({
        status: 'error',
        message: translate(
          'auto.components.editor.PlantUmlBlock.notconfigured',
          'PlantUML rendering is off. Set a plantuml.jar path in Settings → Editor.'
        )
      })
      return
    }

    setState({ status: 'loading' })
    void window.api.plantuml
      .render({ source: content, jarPath })
      .then((result) => {
        if (cancelled) {
          return
        }
        if (result.error !== undefined) {
          setState({ status: 'error', message: result.error })
          return
        }
        // Why: defense-in-depth — the SVG comes from a local process we trust,
        // but sanitizing before injection guards against a malicious diagram
        // source coaxing script/event-handler markup into the output.
        const clean = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true } })
        setState({ status: 'ready', html: normalizeDiagramSvg(clean) })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'PlantUML rendering failed.'
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [content, jarPath])

  if (state.status === 'error') {
    return (
      <div className="plantuml-block">
        <div className="plantuml-error">
          {translate('auto.components.editor.PlantUmlBlock.error', 'Diagram error:')}{' '}
          {state.message}
        </div>
        <pre>
          <code>{content}</code>
        </pre>
      </div>
    )
  }

  if (state.status === 'ready') {
    return (
      <div
        className="plantuml-block plantuml-block--rendered"
        dangerouslySetInnerHTML={{ __html: state.html }}
      />
    )
  }

  return <div className="plantuml-block" />
}
