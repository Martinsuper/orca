import React from 'react'
import PlantUmlBlock from '@/components/editor/PlantUmlBlock'

// Why: react-markdown sets className="language-plantuml" on the <code> inside a
// fenced ```plantuml block. Detecting it lets us render a real diagram instead
// of the raw source, matching the editor's markdown preview.
export function isPlantumlFence(className: string | undefined): boolean {
  return /\blanguage-plantuml\b/.test(className ?? '')
}

export function renderPlantumlFence(
  children: React.ReactNode,
  className?: string
): React.JSX.Element {
  return (
    <div className={className}>
      <PlantUmlBlock content={String(children).trimEnd()} />
    </div>
  )
}

// Why: PlantUmlBlock renders a <div> via innerHTML, which is invalid inside a
// <pre>. The <pre> renderer receives the inner <code> element (not the rendered
// diagram), so detect the plantuml fence from that child's className and unwrap.
export function isPlantumlPre(children: React.ReactNode): boolean {
  const child = React.Children.toArray(children)[0]
  if (!React.isValidElement(child)) {
    return false
  }
  const className = (child.props as { className?: string } | null)?.className
  return isPlantumlFence(className)
}
