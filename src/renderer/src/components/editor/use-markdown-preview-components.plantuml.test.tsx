// @vitest-environment happy-dom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./PlantUmlBlock', () => ({
  default: ({ content }: { content: string }) => <div data-testid="plantuml-diagram">{content}</div>
}))

import { useMarkdownPreviewComponents } from './use-markdown-preview-components'

function PreviewCodeBlock(): React.JSX.Element {
  const components = useMarkdownPreviewComponents({
    foundation: {} as never,
    viewport: {} as never,
    reviewActions: {} as never,
    annotationRenderers: {} as never,
    filePath: '/repo/diagram.md'
  })
  const code = components.code?.({
    className: 'language-plantuml',
    children: '@startuml\nAlice -> Bob\n@enduml'
  })

  return <>{components.pre?.({ children: code })}</>
}

describe('useMarkdownPreviewComponents PlantUML fences', () => {
  let container: HTMLDivElement
  let root: Root

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  it('renders a PlantUML fence without wrapping the diagram in a pre element', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => root.render(<PreviewCodeBlock />))

    expect(container.querySelector('[data-testid="plantuml-diagram"]')?.textContent).toBe(
      '@startuml\nAlice -> Bob\n@enduml'
    )
    expect(container.querySelector('pre')).toBeNull()
  })
})
