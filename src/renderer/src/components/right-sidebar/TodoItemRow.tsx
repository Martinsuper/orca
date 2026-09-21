import { useState } from 'react'
import { Check, Pencil, Trash2, Star, CalendarDays, Sun, ListChecks } from 'lucide-react'
import type { Todo } from '../../../../shared/types'
import { translate } from '@/i18n/i18n'
import { TodoEditDialog, type TodoEditDialogResult } from './TodoEditDialog'
import type { TodoList } from '../../../../shared/types'

type TodoItemRowProps = {
  todo: Todo
  lists: TodoList[]
  canChangeList: boolean
  projectLabel?: string
  onToggle: (todo: Todo, done: boolean) => void
  onEdit: (todo: Todo, result: TodoEditDialogResult) => void
  onRemove: (todo: Todo) => void
}

function isOverdue(dueDate: string | undefined, done: boolean): boolean {
  if (!dueDate || done) {
    return false
  }
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return dueDate < `${yyyy}-${mm}-${dd}`
}

export function TodoItemRow({
  todo,
  lists,
  canChangeList,
  projectLabel,
  onToggle,
  onEdit,
  onRemove
}: TodoItemRowProps): React.JSX.Element {
  const [editOpen, setEditOpen] = useState(false)
  const [armed, setArmed] = useState(false)

  const overdue = isOverdue(todo.dueDate, todo.done)
  const completedSteps = (todo.steps ?? []).filter((s) => s.done).length
  const totalSteps = (todo.steps ?? []).length

  const handleRemove = () => {
    if (armed) {
      onRemove(todo)
    } else {
      setArmed(true)
      setTimeout(() => setArmed(false), 3000)
    }
  }

  return (
    <>
      <div className="group flex items-start gap-2 px-2 py-1.5 hover:bg-muted/50">
        <button
          className="mt-0.5 shrink-0"
          onClick={() => onToggle(todo, !todo.done)}
          aria-label={
            todo.done
              ? translate(
                  'auto.components.right.sidebar.TodoItemRow.markUndone',
                  'Mark as not done'
                )
              : translate('auto.components.right.sidebar.TodoItemRow.markDone', 'Mark as done')
          }
        >
          <div
            className={`flex h-4 w-4 items-center justify-center rounded border ${
              todo.done
                ? 'bg-primary border-primary'
                : 'border-muted-foreground/40 hover:border-muted-foreground'
            }`}
          >
            {todo.done && <Check size={12} className="text-primary-foreground" />}
          </div>
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p
              className={`text-sm leading-snug ${
                todo.done ? 'text-muted-foreground line-through' : ''
              }`}
            >
              {todo.title}
            </p>
            {todo.important && !todo.done && (
              <Star size={12} className="shrink-0 fill-foreground text-foreground" />
            )}
          </div>

          {todo.note && (
            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{todo.note}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {todo.dueDate && (
              <span
                className={`flex items-center gap-1 text-xs ${
                  overdue ? 'text-destructive font-medium' : 'text-muted-foreground'
                }`}
              >
                <CalendarDays size={11} />
                {todo.dueDate}
                {overdue &&
                  translate('auto.components.right.sidebar.TodoItemRow.overdue', ' (overdue)')}
              </span>
            )}
            {totalSteps > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ListChecks size={11} />
                {completedSteps}/{totalSteps}
              </span>
            )}
            {todo.myDayDate && !todo.done && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Sun size={11} />
                {translate('auto.components.right.sidebar.TodoItemRow.myDay', 'My Day')}
              </span>
            )}
            {projectLabel && (
              <span className="text-xs text-muted-foreground truncate">{projectLabel}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            className="p-1 text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            aria-label={translate('auto.components.right.sidebar.TodoItemRow.edit', 'Edit todo')}
          >
            <Pencil size={13} />
          </button>
          <button
            className={`p-1 ${
              armed ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={handleRemove}
            aria-label={
              armed
                ? translate(
                    'auto.components.right.sidebar.TodoItemRow.confirmDelete',
                    'Confirm delete'
                  )
                : translate('auto.components.right.sidebar.TodoItemRow.delete', 'Delete todo')
            }
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <TodoEditDialog
        open={editOpen}
        initial={{
          title: todo.title,
          note: todo.note,
          listId: todo.listId,
          important: todo.important,
          dueDate: todo.dueDate,
          reminderAt: todo.reminderAt,
          myDayDate: todo.myDayDate,
          steps: todo.steps
        }}
        lists={lists}
        canChangeList={canChangeList}
        onClose={() => setEditOpen(false)}
        onSave={(result) => {
          onEdit(todo, result)
          setEditOpen(false)
        }}
      />
    </>
  )
}
