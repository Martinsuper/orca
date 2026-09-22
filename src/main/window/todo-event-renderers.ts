type TodoEventRenderer = {
  id: number
  isDestroyed(): boolean
}

const rendererIds = new Set<number>()

export function registerTodoEventRenderer(webContentsId: number): void {
  rendererIds.add(webContentsId)
}

export function unregisterTodoEventRenderer(webContentsId: number): void {
  rendererIds.delete(webContentsId)
}

export function isRegisteredTodoEventRenderer(renderer: TodoEventRenderer): boolean {
  return !renderer.isDestroyed() && rendererIds.has(renderer.id)
}
