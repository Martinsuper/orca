import { ChevronRight, Folder, FolderOpen, FolderPlus, Link2, Plus, Trash2 } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { Button } from '../ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '../ui/context-menu'
import { linkHost, type LinkNode } from './project-links-tree'
import { translate } from '@/i18n/i18n'
import type { ProjectLink } from '../../../../shared/types'

export type NewLinkRequest = { category: string }
/** dnd-kit data carried by each sortable link row so drop handlers know the
 *  dragged link's category and the drop target's category. */
export type LinkDragData = { linkId: string; category: string }

export type TreeNodeHandlers = {
  onNewLink: (req: NewLinkRequest) => void
  onNewFolder: (parentPath: string) => void
  onRemoveLink: (linkId: string) => void
  onRemoveFolder: (path: string) => void
}

export function LinksEmptyState({
  onManage
}: {
  onManage: (() => void) | null
}): React.JSX.Element {
  return (
    <div className="px-4 py-6">
      <div className="text-sm font-medium text-foreground">
        {translate('auto.components.right.sidebar.projectLinks.emptyTitle', 'No links yet')}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {translate(
          'auto.components.right.sidebar.projectLinks.emptyPanelDescription',
          'Save quick links to this project — test/prod environments, databases, deploy and config pages.'
        )}
      </div>
      {onManage && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onManage}>
          {translate('auto.components.right.sidebar.projectLinks.addFirst', 'Add a link')}
        </Button>
      )}
    </div>
  )
}

export function LinkTreeNode({
  node,
  depth,
  collapsed,
  onToggle,
  ...handlers
}: {
  node: LinkNode
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
} & TreeNodeHandlers): React.JSX.Element {
  // Why: the top-level uncategorized bucket renders its links inline at depth 0,
  // with no folder header — matching the tree's flatten behavior.
  if (node.flatten) {
    return (
      <>
        {node.links.map((link) => (
          <LinkLeafRow
            key={link.id}
            link={link}
            depth={depth}
            onRemoveLink={handlers.onRemoveLink}
            onNewLink={handlers.onNewLink}
          />
        ))}
      </>
    )
  }

  const isExpanded = !collapsed.has(node.path)
  const isEmptyFolder = node.links.length === 0 && node.children.length === 0

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="flex w-full items-center gap-1 rounded-sm py-1 pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            aria-expanded={isExpanded}
          >
            <ChevronRight
              className={cn('size-3 shrink-0 transition-transform', isExpanded && 'rotate-90')}
            />
            {isExpanded ? (
              <FolderOpen className="size-3.5 shrink-0" />
            ) : (
              <Folder className="size-3.5 shrink-0" />
            )}
            <span className="truncate font-medium">{node.name}</span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={() => handlers.onNewLink({ category: node.path })}>
            <Plus />
            {translate('auto.components.right.sidebar.projectLinks.newLinkHere', 'New link here')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => handlers.onNewFolder(node.path)}>
            <FolderPlus />
            {translate('auto.components.right.sidebar.projectLinks.newSubfolder', 'New subfolder')}
          </ContextMenuItem>
          {isEmptyFolder && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onSelect={() => handlers.onRemoveFolder(node.path)}
              >
                <Trash2 />
                {translate(
                  'auto.components.right.sidebar.projectLinks.deleteFolder',
                  'Delete folder'
                )}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {isExpanded && (
        <>
          {node.links.map((link) => (
            <LinkLeafRow
              key={link.id}
              link={link}
              depth={depth + 1}
              onRemoveLink={handlers.onRemoveLink}
              onNewLink={handlers.onNewLink}
            />
          ))}
          {node.children.map((child) => (
            <LinkTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              {...handlers}
            />
          ))}
        </>
      )}
    </>
  )
}

function LinkLeafRow({
  link,
  depth,
  onRemoveLink,
  onNewLink
}: {
  link: ProjectLink
  depth: number
  onRemoveLink: (linkId: string) => void
  onNewLink: (req: NewLinkRequest) => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    data: { linkId: link.id, category: link.category } satisfies LinkDragData
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 16 + 8}px`
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          ref={setNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          onClick={() => void window.api.shell.openUrl(link.url)}
          className={cn(
            'flex w-full items-center gap-1 rounded-sm py-1 pr-2 text-left text-xs transition-colors hover:bg-accent hover:text-foreground',
            isDragging && 'opacity-40'
          )}
          style={style}
          title={link.url}
        >
          <span className="size-3 shrink-0" />
          <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{link.name}</span>
          <span className="ml-auto max-w-[9rem] shrink-0 truncate pl-2 text-[11px] text-muted-foreground">
            {linkHost(link.url)}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onSelect={() => void window.api.shell.openUrl(link.url)}>
          <Link2 />
          {translate('auto.components.right.sidebar.projectLinks.open', 'Open link')}
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onNewLink({ category: link.category })}>
          <Plus />
          {translate('auto.components.right.sidebar.projectLinks.newLinkHere', 'New link here')}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onSelect={() => onRemoveLink(link.id)}>
          <Trash2 />
          {translate('auto.components.right.sidebar.projectLinks.delete', 'Delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
