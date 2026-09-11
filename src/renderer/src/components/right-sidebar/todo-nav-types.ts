export type TodoSmartView = 'my-day' | 'important' | 'planned' | 'all' | 'completed'

export type TodoNavItem =
  | { kind: 'smart-view'; view: TodoSmartView }
  | { kind: 'list'; listId: string }

export function todoNavEquals(a: TodoNavItem | undefined, b: TodoNavItem | undefined): boolean {
  if (!a || !b) {
    return a === b
  }
  if (a.kind !== b.kind) {
    return false
  }
  if (a.kind === 'smart-view' && b.kind === 'smart-view') {
    return a.view === b.view
  }
  if (a.kind === 'list' && b.kind === 'list') {
    return a.listId === b.listId
  }
  return false
}

const SMART_VIEW_TITLES: Record<TodoSmartView, { key: string; fallback: string }> = {
  'my-day': {
    key: 'auto.components.right.sidebar.TodosPanel.myDay',
    fallback: 'My Day'
  },
  important: {
    key: 'auto.components.right.sidebar.TodosPanel.important',
    fallback: 'Important'
  },
  planned: {
    key: 'auto.components.right.sidebar.TodosPanel.planned',
    fallback: 'Planned'
  },
  all: {
    key: 'auto.components.right.sidebar.TodosPanel.all',
    fallback: 'All'
  },
  completed: {
    key: 'auto.components.right.sidebar.TodosPanel.completed',
    fallback: 'Completed'
  }
}

export function smartViewTitle(view: TodoSmartView): {
  key: string
  fallback: string
} {
  return SMART_VIEW_TITLES[view]
}
