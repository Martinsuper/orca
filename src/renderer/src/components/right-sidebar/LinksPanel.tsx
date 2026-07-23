import { useEffect, useMemo, useState } from 'react'
import { FolderPlus, Link2, Loader2, Plus, Settings2 } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useAppStore } from '@/store'
import { useActiveRepo } from '@/store/selectors'
import { Button } from '../ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '../ui/context-menu'
import { ProjectLinksManagerDialog } from './ProjectLinksManagerDialog'
import { ProjectLinkFolderDialog } from './ProjectLinkFolderDialog'
import {
  buildLinkTree,
  collectNodePaths,
  collectVisibleLinkIds,
  computeLinkReorder
} from './project-links-tree'
import {
  LinkTreeNode,
  LinksEmptyState,
  type LinkDragData,
  type NewLinkRequest
} from './LinksPanelRows'
import { translate } from '@/i18n/i18n'
import type { ProjectLink } from '../../../../shared/types'

type NewFolderRequest = { parentPath: string }

export default function LinksPanel(): React.JSX.Element {
  const repo = useActiveRepo()
  const repoId = repo?.id ?? null
  const links = useAppStore((s) => (repoId ? s.projectLinksByRepo[repoId] : undefined))
  const folders = useAppStore((s) => (repoId ? s.projectLinkFoldersByRepo[repoId] : undefined))
  const loadStatus = useAppStore((s) =>
    repoId ? s.projectLinksLoadStatusByRepo[repoId] : undefined
  )
  const loadError = useAppStore((s) => (repoId ? s.projectLinksErrorByRepo[repoId] : undefined))
  const fetchProjectLinks = useAppStore((s) => s.fetchProjectLinks)
  const fetchProjectLinkFolders = useAppStore((s) => s.fetchProjectLinkFolders)
  const removeProjectLink = useAppStore((s) => s.removeProjectLink)
  const removeProjectLinkFolder = useAppStore((s) => s.removeProjectLinkFolder)
  const reorderProjectLinks = useAppStore((s) => s.reorderProjectLinks)

  const [managerOpen, setManagerOpen] = useState(false)
  const [managerCategory, setManagerCategory] = useState('')
  const [managerMode, setManagerMode] = useState<'manage' | 'add'>('manage')
  const [folderRequest, setFolderRequest] = useState<NewFolderRequest | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [draggingLink, setDraggingLink] = useState<ProjectLink | null>(null)

  // Why: an 8px activation distance lets a plain click still open the link;
  // only a deliberate drag past the threshold starts sorting.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  useEffect(() => {
    if (repoId && links === undefined) {
      void fetchProjectLinks(repoId)
    }
  }, [repoId, links, fetchProjectLinks])

  useEffect(() => {
    if (repoId && folders === undefined) {
      void fetchProjectLinkFolders(repoId)
    }
  }, [repoId, folders, fetchProjectLinkFolders])

  const uncategorized = translate(
    'auto.components.right.sidebar.projectLinks.uncategorized',
    'Uncategorized'
  )
  const tree = useMemo(
    () => buildLinkTree(links ?? [], uncategorized, folders ?? []),
    [links, folders, uncategorized]
  )
  const sortableIds = useMemo(() => collectVisibleLinkIds(tree, collapsed), [tree, collapsed])

  // Why: category nodes default to expanded (link counts are small, so showing
  // the whole tree up front beats making the user click into every group).
  const [seededPaths, setSeededPaths] = useState('')
  useEffect(() => {
    const key = collectNodePaths(tree).join(' ')
    if (key !== seededPaths) {
      setSeededPaths(key)
      setCollapsed(new Set())
    }
  }, [tree, seededPaths])

  const toggle = (path: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const openNewLink = (req: NewLinkRequest): void => {
    setManagerMode('add')
    setManagerCategory(req.category)
    setManagerOpen(true)
  }
  const openManage = (): void => {
    setManagerMode('manage')
    setManagerCategory('')
    setManagerOpen(true)
  }

  const handleDragStart = (event: DragStartEvent): void => {
    const data = event.active.data.current as LinkDragData | undefined
    setDraggingLink((links ?? []).find((link) => link.id === data?.linkId) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    setDraggingLink(null)
    const { active, over } = event
    if (!repoId || !over || active.id === over.id) {
      return
    }
    const activeData = active.data.current as LinkDragData | undefined
    const overData = over.data.current as LinkDragData | undefined
    if (!activeData || !overData) {
      return
    }
    // Why: drop lands relative to the "over" link — same category means reorder,
    // different category means move. Index is the over link's slot within its
    // category; computeLinkReorder clamps and renumbers.
    const targetCategory = overData.category
    const inTarget = (links ?? [])
      .filter((l) => l.category === targetCategory && l.id !== activeData.linkId)
      .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name))
    const overIndex = inTarget.findIndex((l) => l.id === overData.linkId)
    const targetIndex = overIndex === -1 ? inTarget.length : overIndex
    const updates = computeLinkReorder(links ?? [], activeData.linkId, targetCategory, targetIndex)
    if (updates.length > 0) {
      void reorderProjectLinks({ repoId, updates })
    }
  }

  if (!repoId) {
    return (
      <div className="flex-1 overflow-auto scrollbar-sleek">
        <LinksEmptyState onManage={null} />
      </div>
    )
  }

  const isLoading = loadStatus === 'loading' && links === undefined
  const isError = loadStatus === 'error'
  const isEmpty = tree.length === 0

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="pl-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {translate('auto.components.right.sidebar.projectLinks.sectionLabel', 'Links')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => openNewLink({ category: '' })}
            aria-label={translate('auto.components.right.sidebar.projectLinks.newLink', 'New link')}
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setFolderRequest({ parentPath: '' })}
            aria-label={translate(
              'auto.components.right.sidebar.projectLinks.newFolder',
              'New folder'
            )}
          >
            <FolderPlus className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={openManage}
            aria-label={translate(
              'auto.components.right.sidebar.projectLinks.manage',
              'Manage links'
            )}
          >
            <Settings2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Why: right-click on empty panel space offers root-level new link/folder. */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex-1 overflow-auto scrollbar-sleek pb-2">
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {translate('auto.components.right.sidebar.projectLinks.loading', 'Loading links…')}
              </div>
            ) : isError ? (
              <div className="px-4 py-6">
                <div className="text-sm font-medium text-foreground">
                  {translate(
                    'auto.components.right.sidebar.projectLinks.loadFailedTitle',
                    'Could not load links'
                  )}
                </div>
                {loadError && <div className="mt-1 text-xs text-muted-foreground">{loadError}</div>}
              </div>
            ) : isEmpty ? (
              <LinksEmptyState onManage={() => openNewLink({ category: '' })} />
            ) : (
              <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setDraggingLink(null)}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  {tree.map((node) => (
                    <LinkTreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      collapsed={collapsed}
                      onToggle={toggle}
                      onNewLink={openNewLink}
                      onNewFolder={(parentPath) => setFolderRequest({ parentPath })}
                      onRemoveLink={(linkId) => void removeProjectLink({ repoId, linkId })}
                      onRemoveFolder={(path) => void removeProjectLinkFolder({ repoId, path })}
                    />
                  ))}
                </SortableContext>
                <DragOverlay dropAnimation={null}>
                  {draggingLink ? (
                    <div className="flex items-center gap-1 rounded-sm bg-accent px-2 py-1 text-xs shadow-md">
                      <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{draggingLink.name}</span>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onSelect={() => openNewLink({ category: '' })}>
            <Plus />
            {translate('auto.components.right.sidebar.projectLinks.newLink', 'New link')}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setFolderRequest({ parentPath: '' })}>
            <FolderPlus />
            {translate('auto.components.right.sidebar.projectLinks.newFolder', 'New folder')}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <ProjectLinksManagerDialog
        open={managerOpen}
        onOpenChange={setManagerOpen}
        repoId={repoId}
        initialCategory={managerCategory}
        mode={managerMode}
      />
      {folderRequest && (
        <ProjectLinkFolderDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setFolderRequest(null)
            }
          }}
          repoId={repoId}
          parentPath={folderRequest.parentPath}
        />
      )}
    </div>
  )
}
