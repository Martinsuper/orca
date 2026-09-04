// @vitest-environment happy-dom
import React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { settings: { theme: string } }) => unknown) =>
    selector({ settings: { theme: 'dark' } })
}))
vi.mock('./PlantUmlBlock', () => ({
  default: ({ content }: { content: string }) => <div data-testid="plantuml-diagram">{content}</div>
}))
vi.mock('./MermaidBlock', () => ({ default: () => null }))
vi.mock('./rich-markdown-code-block-languages', () => ({
  getCodeBlockLanguageLabel: () => 'PlantUML',
  getCodeBlockLanguages: () => [],
  isKnownCodeBlockLanguage: () => true
}))
vi.mock('@/i18n/i18n', () => ({ translate: (_key: string, fallback: string) => fallback }))

import { RichMarkdownCodeBlock } from './RichMarkdownCodeBlock'

describe('RichMarkdownCodeBlock PlantUML preview', () => {
  let container: HTMLDivElement
  let root: Root

  afterEach(() => {
    act(() => root?.unmount())
    container?.remove()
  })

  it('renders a PlantUML preview for PlantUML code blocks', () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    act(() => {
      root.render(
        <RichMarkdownCodeBlock
          node={{ attrs: { language: 'plantuml' }, textContent: '@startuml\nAlice -> Bob\n@enduml' } as never}
          updateAttributes={vi.fn()}
          editor={{} as never}
          getPos={() => 0}
          decorations={[]}
          selected={false}
          extension={{} as never}
          view={{} as never}
          deleteNode={vi.fn()}
        />
      )
    })

    expect(container.querySelector('[data-testid="plantuml-diagram"]')?.textContent).toBe(
      '@startuml\nAlice -> Bob\n@enduml'
    )
  })
})
