import { useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Inbox,
  ListTodo,
  Star,
  Sun,
  Plus,
  Trash2,
  Pencil
} from 'lucide-react'
import type { TodoList } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'
import type { TodoNavItem, TodoSmartView } from './todo-nav-types'

type SmartViewDef = {
  view: TodoSmartView
  icon: typeof Sun
  labelKey: string
  labelFallback: string
}

const SMART_VIEWS: SmartViewDef[] = [
  {
    view: 'my-day',
    icon: Sun,
    labelKey: 'auto.components.right.sidebar.TodoNavigation.myDay',
    labelFallback: 'My Day'
  },
  {
    view: 'important',
    icon: Star,
    labelKey: 'auto.components.right.sidebar.TodoNavigation.important',
    labelFallback: 'Important'
  },
  {
    view: 'planned',
    icon: CalendarDays,
    labelKey: 'auto.components.right.sidebar.TodoNavigation.planned',
    labelFallback: 'Planned'
  },
  {
    view: 'all',
    icon: Inbox,
    labelKey: 'auto.components.right.sidebar.TodoNavigation.all',
    labelFallback: 'All'
  },
  {
    view: 'completed',
    icon: CheckCircle2,
    labelKey: 'auto.components.right.sidebar.TodoNavigation.completed',
    labelFallback: 'Completed'
  }
]

type TodoNavigationProps = {
  lists: TodoList[]
  activeNav: TodoNavItem | undefined
  onNavChange: (nav: TodoNavItem) => void
  onCreateList: (title: string) => void
  onRenameList: (listId: string, title: string) => void
  onDeleteList: (listId: string) => void
}

export function TodoNavigation({
  lists,
  activeNav,
  onNavChange,
  onCreateList,
  onRenameList,
  onDeleteList
}: TodoNavigationProps): React.JSX.Element {
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [armedDelete, setArmedDelete] = useState<string | null>(null)

  const submitCreate = () => {
    const trimmed = newTitle.trim()
    if (trimmed) {
      onCreateList(trimmed)
      setNewTitle('')
      setCreating(false)
    }
  }

  const submitRename = () => {
    const trimmed = editTitle.trim()
    if (trimmed && editingId) {
      onRenameList(editingId, trimmed)
      setEditingId(null)
      setEditTitle('')
    }
  }

  const handleDelete = (listId: string) => {
    if (armedDelete === listId) {
      onDeleteList(listId)
      setArmedDelete(null)
    } else {
      setArmedDelete(listId)
      setTimeout(() => setArmedDelete(null), 3000)
    }
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto scrollbar-sleek">
      {SMART_VIEWS.map((sv) => {
        const Icon = sv.icon
        const isActive = activeNav?.kind === 'smart-view' && activeNav.view === sv.view
        return (
          <button
            key={sv.view}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
            onClick={() => onNavChange({ kind: 'smart-view', view: sv.view })}
          >
            <Icon size={14} className="shrink-0" />
            {translate(sv.labelKey, sv.labelFallback)}
          </button>
        )
      })}

      <div className="px-2 pt-3 pb-1">
        <span className="text-xs font-medium text-muted-foreground">
          {translate('auto.components.right.sidebar.TodoNavigation.lists', 'Lists')}
        </span>
      </div>

      {lists.map((list) => {
        const isActive = activeNav?.kind === 'list' && activeNav.listId === list.id
        const isEditing = editingId === list.id
        return (
          <div
            key={list.id}
            className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            }`}
          >
            {isEditing ? (
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    submitRename()
                  }
                  if (e.key === 'Escape') {
                    setEditingId(null)
                    setEditTitle('')
                  }
                }}
                onBlur={submitRename}
              />
            ) : (
              <>
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => onNavChange({ kind: 'list', listId: list.id })}
                >
                  <ListTodo size={14} className="shrink-0" />
                  <span className="truncate">{list.title}</span>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setEditingId(list.id)
                      setEditTitle(list.title)
                    }}
                    aria-label={translate(
                      'auto.components.right.sidebar.TodoNavigation.renameList',
                      'Rename list'
                    )}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    className={`p-1 ${
                      armedDelete === list.id
                        ? 'text-destructive'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => handleDelete(list.id)}
                    aria-label={
                      armedDelete === list.id
                        ? translate(
                            'auto.components.right.sidebar.TodoNavigation.confirmDelete',
                            'Confirm delete'
                          )
                        : translate(
                            'auto.components.right.sidebar.TodoNavigation.deleteList',
                            'Delete list'
                          )
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}

      {creating ? (
        <div className="flex items-center gap-2 px-2 py-1">
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-input bg-transparent px-2 py-1 text-sm focus:outline-none"
            placeholder={translate(
              'auto.components.right.sidebar.TodoNavigation.listName',
              'List name'
            )}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitCreate()
              }
              if (e.key === 'Escape') {
                setCreating(false)
                setNewTitle('')
              }
            }}
            onBlur={submitCreate}
          />
        </div>
      ) : (
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          onClick={() => setCreating(true)}
        >
          <Plus size={14} className="shrink-0" />
          {translate('auto.components.right.sidebar.TodoNavigation.newList', 'New list')}
        </button>
      )}
    </div>
  )
}
