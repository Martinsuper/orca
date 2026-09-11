import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Todo } from '../../../../shared/types'
import { useAppStore } from '@/store'
import { useActiveRepo } from '@/store/selectors'
import { translate } from '@/i18n/i18n'
import { TodoAddInput } from './TodoAddInput'
import { TodoItemRow } from './TodoItemRow'
import { TodoEmptyState } from './TodoEmptyState'
import { TodoNavigation } from './TodoNavigation'
import { getMyDayTodos, type TodoSaveArgs } from '@/store/slices/todos'
import { filterByList, filterBySmartView } from './todo-view-filters'
import { smartViewTitle, type TodoNavItem } from './todo-nav-types'
import type { TodoEditDialogResult } from './TodoEditDialog'

const SCOPE_TABS = [
  {
    id: 'project' as const,
    labelKey: 'auto.components.right.sidebar.TodosPanel.thisProject',
    labelFallback: 'This project'
  },
  {
    id: 'global' as const,
    labelKey: 'auto.components.right.sidebar.TodosPanel.global',
    labelFallback: 'Global'
  }
]

function todayLocalDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function getActiveRepoName(
  state: ReturnType<typeof useAppStore.getState>,
  repoId: string | null
): string | undefined {
  if (!repoId) {
    return undefined
  }
  const repo = state.repos.find((r) => r.id === repoId)
  return repo?.displayName
}

export default function TodosPanel(): React.JSX.Element {
  const repo = useActiveRepo()
  const repoId = repo?.id ?? null

  const scope = useAppStore((s) => s.todoScope)
  const setTodoScope = useAppStore((s) => s.setTodoScope)

  const todosByRepo = useAppStore((s) => s.todosByRepo)
  const todosLoadStatus = useAppStore((s) => (repoId ? s.todosLoadStatusByRepo[repoId] : undefined))
  const todosError = useAppStore((s) => (repoId ? s.todosErrorByRepo[repoId] : undefined))
  const fetchTodos = useAppStore((s) => s.fetchTodos)
  const saveTodo = useAppStore((s) => s.saveTodo)
  const removeTodo = useAppStore((s) => s.removeTodo)
  const toggleTodo = useAppStore((s) => s.toggleTodo)

  const todoListsByRepo = useAppStore((s) => s.todoListsByRepo)
  const fetchTodoLists = useAppStore((s) => s.fetchTodoLists)
  const saveTodoList = useAppStore((s) => s.saveTodoList)
  const removeTodoList = useAppStore((s) => s.removeTodoList)

  const globalTodos = useAppStore((s) => s.globalTodos)
  const globalTodosLoadStatus = useAppStore((s) => s.globalTodosLoadStatus)
  const globalTodosError = useAppStore((s) => s.globalTodosError)
  const fetchGlobalTodos = useAppStore((s) => s.fetchGlobalTodos)
  const saveGlobalTodo = useAppStore((s) => s.saveGlobalTodo)
  const removeGlobalTodo = useAppStore((s) => s.removeGlobalTodo)
  const toggleGlobalTodo = useAppStore((s) => s.toggleGlobalTodo)

  const globalTodoLists = useAppStore((s) => s.globalTodoLists)
  const fetchGlobalTodoLists = useAppStore((s) => s.fetchGlobalTodoLists)
  const saveGlobalTodoList = useAppStore((s) => s.saveGlobalTodoList)
  const removeGlobalTodoList = useAppStore((s) => s.removeGlobalTodoList)

  const invalidateGlobalTodos = useAppStore((s) => s.invalidateGlobalTodos)

  const isProjectScope = scope === 'project'
  const hasRepo = repoId !== null
  const effectiveRepoId = isProjectScope ? repoId : null

  const [activeNav, setActiveNav] = useState<TodoNavItem | undefined>({
    kind: 'smart-view',
    view: 'all'
  })

  const repoName = useAppStore((s) => getActiveRepoName(s, repoId))

  useEffect(() => {
    // Load primary scope + always load opposite scope for My Day aggregation
    if (isProjectScope && hasRepo && repoId) {
      fetchTodos(repoId)
      fetchTodoLists(repoId)
      fetchGlobalTodos()
      fetchGlobalTodoLists()
    } else if (!isProjectScope) {
      fetchGlobalTodos()
      fetchGlobalTodoLists()
      if (hasRepo && repoId) {
        fetchTodos(repoId)
        fetchTodoLists(repoId)
      }
    }
  }, [
    isProjectScope,
    hasRepo,
    repoId,
    fetchTodos,
    fetchTodoLists,
    fetchGlobalTodos,
    fetchGlobalTodoLists
  ])

  const activeTodos = effectiveRepoId ? (todosByRepo[effectiveRepoId] ?? undefined) : globalTodos
  const activeLists = useMemo(
    () => (effectiveRepoId ? (todoListsByRepo[effectiveRepoId] ?? []) : (globalTodoLists ?? [])),
    [effectiveRepoId, todoListsByRepo, globalTodoLists]
  )

  const loadStatus = effectiveRepoId ? todosLoadStatus : globalTodosLoadStatus
  const error = effectiveRepoId ? todosError : globalTodosError

  const isLoading = loadStatus === 'loading'
  const isLoaded = loadStatus === 'loaded'

  const isMyDayView = activeNav?.kind === 'smart-view' && activeNav.view === 'my-day'
  const isCompletedView = activeNav?.kind === 'smart-view' && activeNav.view === 'completed'

  // For My Day: aggregate global + current project todos
  const myDayTodos = useMemo(() => {
    if (!isMyDayView) {
      return []
    }
    const today = todayLocalDate()
    const repoTodosMap: Record<string, Todo[]> = {}
    if (repoId && todosByRepo[repoId]) {
      repoTodosMap[repoId] = todosByRepo[repoId]!
    }
    return getMyDayTodos(repoTodosMap, globalTodos, today)
  }, [isMyDayView, repoId, todosByRepo, globalTodos])

  const visibleTodos = useMemo(() => {
    if (isMyDayView) {
      return myDayTodos
    }

    const source = activeTodos ?? []
    if (!activeNav || activeNav.kind === 'smart-view') {
      const view = activeNav?.kind === 'smart-view' ? activeNav.view : 'all'
      const filtered = filterBySmartView(source)
      switch (view) {
        case 'my-day':
          return myDayTodos
        case 'important':
          return filtered.important
        case 'planned':
          return filtered.planned
        case 'all':
          return filtered.all
        case 'completed':
          return filtered.completed
      }
    }
    if (activeNav.kind === 'list') {
      return filterByList(source, activeNav.listId)
    }
    return []
  }, [activeNav, activeTodos, isMyDayView, myDayTodos])

  const isEmpty = isLoaded && visibleTodos.length === 0 && !isMyDayView
  const myDayEmpty = isMyDayView && myDayTodos.length === 0

  const handleAdd = async (title: string) => {
    const targetListId = activeNav?.kind === 'list' ? activeNav.listId : activeLists[0]?.id
    if (effectiveRepoId) {
      void saveTodo({ repoId: effectiveRepoId, title, listId: targetListId })
    } else {
      const args: Omit<TodoSaveArgs, 'repoId'> = { title, listId: targetListId }
      await saveGlobalTodo(args)
      invalidateGlobalTodos()
    }
  }

  const handleToggle = (todoId: string, done: boolean) => {
    if (effectiveRepoId) {
      void toggleTodo({ repoId: effectiveRepoId, todoId, done })
    } else {
      void toggleGlobalTodo({ todoId, done })
    }
  }

  const handleRemove = (todoId: string) => {
    if (effectiveRepoId) {
      void removeTodo({ repoId: effectiveRepoId, todoId })
    } else {
      void removeGlobalTodo({ todoId })
    }
  }

  const handleEdit = async (todoId: string, result: TodoEditDialogResult) => {
    const editRepoId = effectiveRepoId ?? ''
    const args = {
      id: todoId,
      title: result.title,
      note: result.note,
      listId: result.listId,
      important: result.important,
      dueDate: result.dueDate,
      reminderAt: result.reminderAt,
      myDayDate: result.myDayDate,
      steps: result.steps
    }
    if (effectiveRepoId) {
      void saveTodo({ repoId: editRepoId, ...args })
    } else {
      void saveGlobalTodo(args)
      invalidateGlobalTodos()
    }
  }

  const handleCreateList = (title: string) => {
    if (effectiveRepoId) {
      void saveTodoList({ repoId: effectiveRepoId, title })
    } else {
      void saveGlobalTodoList({ title })
    }
  }

  const handleRenameList = (listId: string, title: string) => {
    if (effectiveRepoId) {
      void saveTodoList({ repoId: effectiveRepoId, id: listId, title })
    } else {
      void saveGlobalTodoList({ id: listId, title })
    }
  }

  const handleDeleteList = (listId: string) => {
    if (effectiveRepoId) {
      void removeTodoList({ repoId: effectiveRepoId, listId })
    } else {
      void removeGlobalTodoList({ listId })
    }
    if (activeNav?.kind === 'list' && activeNav.listId === listId) {
      setActiveNav({ kind: 'smart-view', view: 'all' })
    }
  }

  const navTitle = useMemo(() => {
    if (!activeNav) {
      return translate('auto.components.right.sidebar.TodosPanel.all', 'All')
    }
    if (activeNav.kind === 'smart-view') {
      const t = smartViewTitle(activeNav.view)
      return translate(t.key, t.fallback)
    }
    return activeLists.find((l) => l.id === activeNav.listId)?.title ?? ''
  }, [activeNav, activeLists])

  const canQuickAdd = !isCompletedView && !isMyDayView && (!isProjectScope || hasRepo)
  const canChangeList = activeLists.length > 0

  const projectLabelForMyDay = (todo: Todo): string | undefined => {
    if (!isMyDayView) {
      return undefined
    }
    if (!todo.repoId) {
      return translate('auto.components.right.sidebar.TodosPanel.globalSource', 'Global')
    }
    return todo.repoId === repoId ? repoName : undefined
  }

  const showEmpty = (isEmpty || myDayEmpty) && !error
  const emptyStateMessage = myDayEmpty
    ? translate(
        'auto.components.right.sidebar.TodosPanel.myDayEmpty',
        'No tasks added to My Day. Add tasks from any list to focus on today.'
      )
    : isProjectScope && !hasRepo
      ? translate('auto.components.right.sidebar.TodosPanel.noProject', 'No project selected.')
      : isCompletedView
        ? translate('auto.components.right.sidebar.TodosPanel.noCompleted', 'No completed tasks.')
        : translate(
            'auto.components.right.sidebar.TodosPanel.empty',
            'No todos yet. Add your first one above.'
          )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              scope === tab.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setTodoScope(tab.id)}
          >
            {translate(tab.labelKey, tab.labelFallback)}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-44 shrink-0 overflow-y-auto scrollbar-sleek border-r p-1">
          <TodoNavigation
            lists={activeLists}
            activeNav={activeNav}
            onNavChange={setActiveNav}
            onCreateList={handleCreateList}
            onRenameList={handleRenameList}
            onDeleteList={handleDeleteList}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b px-2 py-1.5">
            <span className="text-sm font-semibold">{navTitle}</span>
          </div>

          {canQuickAdd && (
            <TodoAddInput
              onAdd={handleAdd}
              placeholder={
                isProjectScope && !hasRepo
                  ? translate(
                      'auto.components.right.sidebar.TodosPanel.selectProject',
                      'Select a project first…'
                    )
                  : translate('auto.components.right.sidebar.TodosPanel.addTodo', 'Add a todo…')
              }
            />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-sleek">
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            )}

            {error && (
              <TodoEmptyState
                message={translate(
                  'auto.components.right.sidebar.TodosPanel.loadError',
                  'Could not load todos: {{error}}',
                  { error }
                )}
              />
            )}

            {showEmpty && <TodoEmptyState message={emptyStateMessage} />}

            {isLoaded &&
              !error &&
              !showEmpty &&
              visibleTodos.map((todo) => (
                <TodoItemRow
                  key={todo.id}
                  todo={todo}
                  lists={activeLists}
                  canChangeList={canChangeList}
                  projectLabel={projectLabelForMyDay(todo)}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onRemove={handleRemove}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
