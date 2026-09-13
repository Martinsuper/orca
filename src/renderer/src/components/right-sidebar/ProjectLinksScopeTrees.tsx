import { Globe } from 'lucide-react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { translate } from '@/i18n/i18n'
import { LinkTreeNode, type LinkScope, type TreeNodeHandlers } from './LinksPanelRows'
import type { LinkNode } from './project-links-tree'

type ProjectLinksScopeTreesProps = TreeNodeHandlers & {
  collapsed: Set<string>
  globalLoadError?: string
  globalSortableIds: string[]
  globalTree: LinkNode[]
  isGlobalError: boolean
  localSortableIds: string[]
  localTree: LinkNode[]
  onToggle: (path: string) => void
  onNewFolderInScope: (parentPath: string, scope: LinkScope) => void
}

export function ProjectLinksScopeTrees({
  collapsed,
  globalLoadError,
  globalSortableIds,
  globalTree,
  isGlobalError,
  localSortableIds,
  localTree,
  onToggle,
  onNewFolderInScope,
  ...handlers
}: ProjectLinksScopeTreesProps): React.JSX.Element {
  const hasGlobal = globalTree.length > 0
  const hasLocal = localTree.length > 0
  return (
    <>
      {hasGlobal && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground/80">
            <Globe className="size-3" />
            {translate(
              'auto.components.right.sidebar.projectLinks.globalGroup',
              'Global (all projects)'
            )}
          </div>
          <SortableContext items={globalSortableIds} strategy={verticalListSortingStrategy}>
            {globalTree.map((node) => (
              <LinkTreeNode
                key={`global:${node.path}`}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggle={onToggle}
                scope="global"
                {...handlers}
                onNewFolder={({ parentPath }) => onNewFolderInScope(parentPath, 'global')}
              />
            ))}
          </SortableContext>
        </div>
      )}
      {isGlobalError && globalLoadError && (
        <div className="px-4 py-2 text-[11px] text-muted-foreground">{globalLoadError}</div>
      )}
      {hasLocal && (
        <div>
          {hasGlobal && (
            <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground/80">
              {translate('auto.components.right.sidebar.projectLinks.localGroup', 'This project')}
            </div>
          )}
          <SortableContext items={localSortableIds} strategy={verticalListSortingStrategy}>
            {localTree.map((node) => (
              <LinkTreeNode
                key={`local:${node.path}`}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggle={onToggle}
                scope="local"
                {...handlers}
                onNewFolder={({ parentPath }) => onNewFolderInScope(parentPath, 'local')}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </>
  )
}
