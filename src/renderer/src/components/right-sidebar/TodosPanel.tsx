import { useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import type { Todo, TodoList } from '../../../../shared/types'
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
import { useTodoLocalDate } from './use-todo-local-date'

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

function getTodoListsForOwner(
  todo: Todo,
  todoListsByRepo: Record<string, TodoList[]>,
  globalTodoLists: TodoList[] | undefined
): TodoList[] {
  return todo.repoId ? (todoListsByRepo[todo.repoId] ?? []) : (globalTodoLists ?? [])
}

export default function TodosPanel(): React.JSX.Element {
  const repo = useActiveRepo()
  const repoId = repo?.id ?? null
  const localDate = useTodoLocalDate()

  const scope = useAppStore((s) => s.todoScope)
  const setTodoScope = useAppStore((s) => s.setTodoScope)
  const todoNavigationByScope = useAppStore((s) => s.todoNavigationByScope)
  const setTodoNavigation = useAppStore((s) => s.setTodoNavigation)

  const todosByRepo = useAppStore((s) => s.todosByRepo)
  const todosLoadStatus = useAppStore((s) => (repoId ? s.todosLoadStatusByRepo[repoId] : undefined))
  const todosError = useAppStore((s) => (repoId ? s.todosErrorByRepo[repoId] : undefined))
  const fetchTodos = useAppStore((s) => s.fetchTodos)
  const saveTodo = useAppStore((s) => s.saveTodo)
  const removeTodo = useAppStore((s) => s.removeTodo)
  const toggleTodo = useAppStore((s) => s.toggleTodo)

  const todoListsByRepo = useAppStore((s) => s.todoListsByRepo)
  const todoListsLoading = useAppStore((s) =>
    repoId ? (s.todoListsLoadingByRepo[repoId] ?? false) : false
  )
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
  const globalTodoListsLoading = useAppStore((s) => s.globalTodoListsLoading)
  const fetchGlobalTodoLists = useAppStore((s) => s.fetchGlobalTodoLists)
  const saveGlobalTodoList = useAppStore((s) => s.saveGlobalTodoList)
  const removeGlobalTodoList = useAppStore((s) => s.removeGlobalTodoList)

  const isProjectScope = scope === 'project'
  const hasRepo = repoId !== null
  const effectiveRepoId = isProjectScope ? repoId : null
  const scopeKey = isProjectScope ? (repoId ? `project:${repoId}` : 'project:no-repo') : 'global'
  const activeNav: TodoNavItem | undefined = todoNavigationByScope[scopeKey]
  const repoName = useAppStore((s) => getActiveRepoName(s, repoId))

  useEffect(() => {
    if (repoId) {
      fetchTodos(repoId)
      fetchTodoLists(repoId)
    }
    fetchGlobalTodos()
    fetchGlobalTodoLists()
  }, [repoId, fetchTodos, fetchTodoLists, fetchGlobalTodos, fetchGlobalTodoLists])

  const activeTodos = isProjectScope
    ? effectiveRepoId
      ? todosByRepo[effectiveRepoId]
      : undefined
    : globalTodos
  const loadedLists = isProjectScope
    ? effectiveRepoId
      ? todoListsByRepo[effectiveRepoId]
      : undefined
    : globalTodoLists
  const activeLists = useMemo(() => loadedLists ?? [], [loadedLists])
  const listsLoading = isProjectScope
    ? effectiveRepoId
      ? todoListsLoading
      : false
    : globalTodoListsLoading
  const loadStatus = isProjectScope
    ? effectiveRepoId
      ? todosLoadStatus
      : undefined
    : globalTodosLoadStatus
  const error = isProjectScope ? (effectiveRepoId ? todosError : undefined) : globalTodosError
  const isLoading = loadStatus === 'loading'

  useEffect(() => {
    if (
      loadedLists !== undefined &&
      !listsLoading &&
      activeNav?.kind === 'list' &&
      !loadedLists.some((list) => list.id === activeNav.listId)
    ) {
      setTodoNavigation(scopeKey, { kind: 'smart-view', view: 'all' })
    }
  }, [activeNav, listsLoading, loadedLists, scopeKey, setTodoNavigation])

  const isMyDayView = activeNav?.kind === 'smart-view' && activeNav.view === 'my-day'
  const isCompletedView = activeNav?.kind === 'smart-view' && activeNav.view === 'completed'

  const myDayTodos = useMemo(() => {
    if (!isMyDayView) {
      return []
    }
    const repoTodosMap: Record<string, Todo[]> = {}
    if (repoId && todosByRepo[repoId]) {
      repoTodosMap[repoId] = todosByRepo[repoId]
    }
    return getMyDayTodos(repoTodosMap, globalTodos, localDate)
  }, [globalTodos, isMyDayView, localDate, repoId, todosByRepo])

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
    return filterByList(source, activeNav.listId)
  }, [activeNav, activeTodos, isMyDayView, myDayTodos])

  const isEmpty = activeTodos !== undefined && visibleTodos.length === 0 && !isMyDayView
  const myDayDataReady = globalTodos !== undefined && (!repoId || todosByRepo[repoId] !== undefined)
  const myDayEmpty = isMyDayView && myDayDataReady && myDayTodos.length === 0

  const handleAdd = (title: string) => {
    const targetListId = activeNav?.kind === 'list' ? activeNav.listId : activeLists[0]?.id
    if (effectiveRepoId) {
      void saveTodo({ repoId: effectiveRepoId, title, listId: targetListId })
    } else if (!isProjectScope) {
      const args: Omit<TodoSaveArgs, 'repoId'> = { title, listId: targetListId }
      void saveGlobalTodo(args)
    }
  }

  const handleToggle = (todo: Todo, done: boolean) => {
    if (todo.repoId) {
      void toggleTodo({ repoId: todo.repoId, todoId: todo.id, done })
    } else {
      void toggleGlobalTodo({ todoId: todo.id, done })
    }
  }

  const handleRemove = (todo: Todo) => {
    if (todo.repoId) {
      void removeTodo({ repoId: todo.repoId, todoId: todo.id })
    } else {
      void removeGlobalTodo({ todoId: todo.id })
    }
  }

  const handleEdit = (todo: Todo, result: TodoEditDialogResult) => {
    const args = {
      id: todo.id,
      title: result.title,
      note: result.note,
      listId: result.listId,
      important: result.important,
      dueDate: result.dueDate,
      reminderAt: result.reminderAt,
      myDayDate: result.myDayDate,
      steps: result.steps
    }
    if (todo.repoId) {
      void saveTodo({ repoId: todo.repoId, ...args })
    } else {
      void saveGlobalTodo(args)
    }
  }

  const handleCreateList = (title: string) => {
    if (effectiveRepoId) {
      void saveTodoList({ repoId: effectiveRepoId, title })
    } else if (!isProjectScope) {
      void saveGlobalTodoList({ title })
    }
  }

  const handleRenameList = (listId: string, title: string) => {
    if (effectiveRepoId) {
      void saveTodoList({ repoId: effectiveRepoId, id: listId, title })
    } else if (!isProjectScope) {
      void saveGlobalTodoList({ id: listId, title })
    }
  }

  const handleDeleteList = (listId: string) => {
    if (effectiveRepoId) {
      void removeTodoList({ repoId: effectiveRepoId, listId })
    } else if (!isProjectScope) {
      void removeGlobalTodoList({ listId })
    }
    if (activeNav?.kind === 'list' && activeNav.listId === listId) {
      setTodoNavigation(scopeKey, { kind: 'smart-view', view: 'all' })
    }
  }

  const navTitle = useMemo(() => {
    if (!activeNav || activeNav.kind === 'smart-view') {
      const view = activeNav?.kind === 'smart-view' ? activeNav.view : 'all'
      const title = smartViewTitle(view)
      return translate(title.key, title.fallback)
    }
    return activeLists.find((list) => list.id === activeNav.listId)?.title ?? ''
  }, [activeLists, activeNav])

  const canQuickAdd = !isCompletedView && !isMyDayView && (!isProjectScope || hasRepo)
  const projectLabelForMyDay = (todo: Todo): string | undefined => {
    if (!isMyDayView) {
      return undefined
    }
    if (!todo.repoId) {
      return translate('auto.components.right.sidebar.TodosPanel.globalSource', 'Global')
    }
    return todo.repoId === repoId ? repoName : undefined
  }

  const showEmpty =
    (isEmpty || myDayEmpty || (!isMyDayView && isProjectScope && !hasRepo)) && !error
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
        <div className="w-44 shrink-0 overflow-y-auto border-r p-1 scrollbar-sleek">
          <TodoNavigation
            lists={activeLists}
            activeNav={activeNav}
            onNavChange={(target) => setTodoNavigation(scopeKey, target)}
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
              placeholder={translate(
                'auto.components.right.sidebar.TodosPanel.addTodo',
                'Add a todo…'
              )}
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

            {!showEmpty &&
              visibleTodos.map((todo) => {
                const lists = getTodoListsForOwner(todo, todoListsByRepo, globalTodoLists)
                return (
                  <TodoItemRow
                    key={`${todo.repoId}:${todo.id}`}
                    todo={todo}
                    lists={lists}
                    canChangeList={lists.length > 0}
                    projectLabel={projectLabelForMyDay(todo)}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onRemove={handleRemove}
                  />
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
