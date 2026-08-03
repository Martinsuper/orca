import { useMemo } from 'react'
import { ExternalLink, Link2, Loader2, Pencil, Trash2 } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import { linkHost } from './project-links-tree'
import type { ProjectLink } from '../../../../shared/types'

type ProjectLinksManagerListProps = {
  confirmingDeleteId: string | null
  deletingId: string | null
  editingId: string | null
  links: ProjectLink[]
  onDelete: (link: ProjectLink) => void
  onDeleteBlur: () => void
  onEdit: (link: ProjectLink) => void
}

export function ProjectLinksManagerList({
  confirmingDeleteId,
  deletingId,
  editingId,
  links,
  onDelete,
  onDeleteBlur,
  onEdit
}: ProjectLinksManagerListProps): React.JSX.Element {
  const grouped = useMemo(() => {
    const uncategorized = translate(
      'auto.components.right.sidebar.projectLinks.uncategorized',
      'Uncategorized'
    )
    return groupLinksByCategory(links, uncategorized)
  }, [links])

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Link2 className="size-7 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          {translate(
            'auto.components.right.sidebar.projectLinks.emptyManaged',
            'No links yet. Add your first one below.'
          )}
        </p>
      </div>
    )
  }

  return (
    <>
      {grouped.map((group) => (
        <div key={group.category} className="flex flex-col gap-1">
          <div className="border-b border-border/40 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {group.category.split('/').join(' / ')}
          </div>
          {group.links.map((link) => {
            const confirming = confirmingDeleteId === link.id
            const isDeleting = deletingId === link.id
            return (
              <div
                key={link.id}
                className={cn(
                  'group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-border/50 hover:bg-accent/40',
                  editingId === link.id && 'border-border bg-accent'
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                  <Link2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{link.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {linkHost(link.url)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void window.api.shell.openUrl(link.url)}
                    aria-label={translate(
                      'auto.components.right.sidebar.projectLinks.open',
                      'Open link'
                    )}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onEdit(link)}
                    disabled={isDeleting}
                    aria-label={translate(
                      'auto.components.right.sidebar.projectLinks.edit',
                      'Edit link'
                    )}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant={confirming ? 'destructive' : 'ghost'}
                    size="sm"
                    onClick={() => onDelete(link)}
                    onBlur={onDeleteBlur}
                    disabled={isDeleting}
                    className={cn(
                      'w-[5.5rem] px-2 text-xs',
                      !confirming && 'text-muted-foreground'
                    )}
                    aria-label={translate(
                      'auto.components.right.sidebar.projectLinks.delete',
                      'Delete link'
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    {confirming
                      ? translate('auto.components.right.sidebar.projectLinks.confirm', 'Confirm')
                      : translate('auto.components.right.sidebar.projectLinks.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </>
  )
}

type ProjectLinkGroup = { category: string; links: ProjectLink[] }

function groupLinksByCategory(links: ProjectLink[], uncategorized: string): ProjectLinkGroup[] {
  const byCategory = new Map<string, ProjectLink[]>()
  for (const link of links) {
    const key = link.category.trim() || uncategorized
    const bucket = byCategory.get(key)
    if (bucket) {
      bucket.push(link)
    } else {
      byCategory.set(key, [link])
    }
  }
  return [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, groupLinks]) => ({ category, links: groupLinks }))
}
