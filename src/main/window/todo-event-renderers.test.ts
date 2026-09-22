import { describe, expect, it } from 'vitest'
import {
  isRegisteredTodoEventRenderer,
  registerTodoEventRenderer,
  unregisterTodoEventRenderer
} from './todo-event-renderers'

function makeRenderer(id: number, destroyed = false) {
  return { id, isDestroyed: () => destroyed }
}

describe('Todo event renderer registry', () => {
  it('accepts every explicitly registered main renderer and rejects others', () => {
    const first = makeRenderer(101)
    const second = makeRenderer(102)
    const external = makeRenderer(103)
    const destroyed = makeRenderer(104, true)
    registerTodoEventRenderer(first.id)
    registerTodoEventRenderer(second.id)
    registerTodoEventRenderer(destroyed.id)

    expect(isRegisteredTodoEventRenderer(first)).toBe(true)
    expect(isRegisteredTodoEventRenderer(second)).toBe(true)
    expect(isRegisteredTodoEventRenderer(external)).toBe(false)
    expect(isRegisteredTodoEventRenderer(destroyed)).toBe(false)

    unregisterTodoEventRenderer(first.id)
    unregisterTodoEventRenderer(second.id)
    unregisterTodoEventRenderer(destroyed.id)
  })
})
