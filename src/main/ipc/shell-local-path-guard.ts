import { isAbsolute, normalize } from 'node:path'
import { stat } from 'node:fs/promises'
import type { Store } from '../persistence'

async function pathExists(pathValue: string): Promise<boolean> {
  try {
    await stat(pathValue)
    return true
  } catch {
    return false
  }
}

export async function validateLocalPathTarget(
  pathValue: string
): Promise<{ ok: true; path: string } | { ok: false; reason: 'not-absolute' | 'not-found' }> {
  const normalizedPath = normalize(pathValue)
  if (!isAbsolute(normalizedPath)) {
    return { ok: false, reason: 'not-absolute' }
  }
  if (!(await pathExists(normalizedPath))) {
    return { ok: false, reason: 'not-found' }
  }
  return { ok: true, path: normalizedPath }
}

export function hasActiveRuntime(store: Store): boolean {
  return Boolean(store.getSettings().activeRuntimeEnvironmentId?.trim())
}

export async function pathExistsAsync(pathValue: string): Promise<boolean> {
  return pathExists(pathValue)
}
