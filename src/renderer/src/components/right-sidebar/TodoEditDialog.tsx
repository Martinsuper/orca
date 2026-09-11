import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import { translate } from '@/i18n/i18n'
import type { TodoList, TodoStep } from '../../../../shared/types'

export type TodoEditDialogResult = {
  title: string
  note: string
  listId: string
  important: boolean
  dueDate: string | undefined
  reminderAt: number | undefined
  myDayDate: string | undefined
  steps: TodoStep[]
}

type TodoEditDialogProps = {
  open: boolean
  initial: Partial<TodoEditDialogResult> & { title: string }
  lists: TodoList[]
  canChangeList: boolean
  onClose: () => void
  onSave: (result: TodoEditDialogResult) => void
}

function todayLocalDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function epochToDatetimeLocal(epoch: number | undefined): string {
  if (!epoch) {
    return ''
  }
  const d = new Date(epoch)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function datetimeLocalToEpoch(value: string): number | undefined {
  if (!value) {
    return undefined
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.getTime()
}

let stepIdCounter = 0
function newStepId(): string {
  stepIdCounter += 1
  return `step-${Date.now()}-${stepIdCounter}`
}

export function TodoEditDialog({
  open,
  initial,
  lists,
  canChangeList,
  onClose,
  onSave
}: TodoEditDialogProps): React.JSX.Element | null {
  const [title, setTitle] = useState(initial.title ?? '')
  const [note, setNote] = useState(initial.note ?? '')
  const [listId, setListId] = useState(initial.listId ?? lists[0]?.id ?? '')
  const [important, setImportant] = useState(initial.important ?? false)
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '')
  const [reminderLocal, setReminderLocal] = useState(epochToDatetimeLocal(initial.reminderAt))
  const [myDay, setMyDay] = useState<boolean>(!!initial.myDayDate)
  const [steps, setSteps] = useState<TodoStep[]>(initial.steps ?? [])
  const [newStepTitle, setNewStepTitle] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(initial.title ?? '')
      setNote(initial.note ?? '')
      setListId(initial.listId ?? lists[0]?.id ?? '')
      setImportant(initial.important ?? false)
      setDueDate(initial.dueDate ?? '')
      setReminderLocal(epochToDatetimeLocal(initial.reminderAt))
      setMyDay(!!initial.myDayDate)
      setSteps(initial.steps ?? [])
      setNewStepTitle('')
      requestAnimationFrame(() => titleRef.current?.focus())
    }
  }, [open, initial, lists])

  if (!open) {
    return null
  }

  const handleSave = () => {
    const trimmed = title.trim()
    if (trimmed.length === 0) {
      return
    }
    onSave({
      title: trimmed,
      note: note.trim(),
      listId,
      important,
      dueDate: dueDate || undefined,
      reminderAt: datetimeLocalToEpoch(reminderLocal),
      myDayDate: myDay ? todayLocalDate() : undefined,
      steps: steps.filter((s) => s.title.trim())
    })
  }

  const addStep = () => {
    const trimmed = newStepTitle.trim()
    if (!trimmed) {
      return
    }
    setSteps([...steps, { id: newStepId(), title: trimmed, done: false, updatedAt: Date.now() }])
    setNewStepTitle('')
  }

  const toggleStep = (stepId: string) => {
    setSteps(
      steps.map((s) => (s.id === stepId ? { ...s, done: !s.done, updatedAt: Date.now() } : s))
    )
  }

  const removeStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId))
  }

  const completedSteps = steps.filter((s) => s.done).length

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {translate('auto.components.right.sidebar.TodoEditDialog.editTask', 'Edit Task')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-edit-title">
              {translate('auto.components.right.sidebar.TodoEditDialog.title', 'Title')}
            </Label>
            <Input
              id="todo-edit-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave()
                }
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-edit-note">
              {translate('auto.components.right.sidebar.TodoEditDialog.note', 'Note')}
            </Label>
            <Textarea
              id="todo-edit-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {canChangeList && lists.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="todo-edit-list">
                {translate('auto.components.right.sidebar.TodoEditDialog.list', 'List')}
              </Label>
              <select
                id="todo-edit-list"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="todo-edit-important">
              {translate('auto.components.right.sidebar.TodoEditDialog.important', 'Important')}
            </Label>
            <Switch id="todo-edit-important" checked={important} onCheckedChange={setImportant} />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="todo-edit-myday">
              {translate(
                'auto.components.right.sidebar.TodoEditDialog.addToMyDay',
                'Add to My Day'
              )}
            </Label>
            <Switch id="todo-edit-myday" checked={myDay} onCheckedChange={setMyDay} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-edit-due">
              {translate('auto.components.right.sidebar.TodoEditDialog.dueDate', 'Due date')}
            </Label>
            <Input
              id="todo-edit-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="todo-edit-reminder">
              {translate('auto.components.right.sidebar.TodoEditDialog.reminder', 'Reminder')}
            </Label>
            <Input
              id="todo-edit-reminder"
              type="datetime-local"
              value={reminderLocal}
              onChange={(e) => setReminderLocal(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              {translate('auto.components.right.sidebar.TodoEditDialog.steps', 'Steps')}
              {steps.length > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {completedSteps}/{steps.length}
                </span>
              )}
            </Label>
            <div className="flex flex-col gap-1">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
                >
                  <button
                    className="shrink-0"
                    onClick={() => toggleStep(step.id)}
                    aria-label={
                      step.done
                        ? translate(
                            'auto.components.right.sidebar.TodoEditDialog.markStepUndone',
                            'Mark as not done'
                          )
                        : translate(
                            'auto.components.right.sidebar.TodoEditDialog.markStepDone',
                            'Mark as done'
                          )
                    }
                  >
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        step.done
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground/40 hover:border-muted-foreground'
                      }`}
                    >
                      {step.done && <Check size={12} className="text-primary-foreground" />}
                    </div>
                  </button>
                  <span
                    className={`min-w-0 flex-1 text-sm ${
                      step.done ? 'text-muted-foreground line-through' : ''
                    }`}
                  >
                    {step.title}
                  </span>
                  <button
                    className="shrink-0 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => removeStep(step.id)}
                    aria-label={translate(
                      'auto.components.right.sidebar.TodoEditDialog.removeStep',
                      'Remove step'
                    )}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-1 py-1">
                <Plus size={14} className="shrink-0 text-muted-foreground" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                  placeholder={translate(
                    'auto.components.right.sidebar.TodoEditDialog.addStep',
                    'Add a step…'
                  )}
                  value={newStepTitle}
                  onChange={(e) => setNewStepTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addStep()
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {translate('auto.components.right.sidebar.TodoEditDialog.cancel', 'Cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={title.trim().length === 0}>
            {translate('auto.components.right.sidebar.TodoEditDialog.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
