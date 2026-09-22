import { randomUUID } from 'node:crypto'
import type { TodoStep } from '../../../shared/types'

const MAX_TITLE_LENGTH = 500
const MAX_NOTE_LENGTH = 2000
const MAX_STEP_TITLE_LENGTH = 500

export type SaveTodoArgs = {
  repoId: string
  id?: string
  listId?: string
  title: string
  note?: string
  important?: boolean
  dueDate?: string | null
  reminderAt?: number | null
  myDayDate?: string | null
  steps?: TodoStep[]
}

export function normalizeTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('Title must not be empty.')
  }
  return trimmed.slice(0, MAX_TITLE_LENGTH)
}

export function normalizeNote(value: string | undefined): string {
  return (value ?? '').trim().slice(0, MAX_NOTE_LENGTH)
}

export function normalizeSteps(steps: TodoStep[] | undefined): TodoStep[] {
  if (!steps || steps.length === 0) {
    return []
  }
  const now = Date.now()
  return steps.map((step) => ({
    id: step.id || randomUUID(),
    title: step.title.trim().slice(0, MAX_STEP_TITLE_LENGTH),
    done: step.done ?? false,
    updatedAt: step.updatedAt ?? now
  }))
}

export function normalizeListTitle(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error('List title must not be empty.')
  }
  return trimmed.slice(0, MAX_TITLE_LENGTH)
}

export function validateDate(value: string | null, label = 'Due date'): string | undefined {
  if (value === null) {
    return undefined
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be in YYYY-MM-DD format.`)
  }
  return value
}

export function validateReminderAt(value: number | null): number | undefined {
  if (value === null) {
    return undefined
  }
  if (!Number.isFinite(value)) {
    throw new Error('Reminder time must be finite.')
  }
  return value
}
