import { spawn } from 'node:child_process'
import { posix, win32 } from 'node:path'
import type {
  ShellOpenExternalEditorRequest,
  ShellOpenExternalEditorResult
} from '../../shared/shell-open-types'
import type { Store } from '../persistence'
import { getSpawnArgsForWindows } from '../win32-utils'
import {
  resolveExternalEditorLaunchSpec,
  resolveVsCodeRemoteSshLaunchSpec,
  type ExternalEditorLaunchSpec
} from '../external-editor-launch'
import { resolveVsCodeSshAuthority } from '../ssh/vscode-ssh-authority'
import { hasActiveRuntime, validateLocalPathTarget } from './shell-local-path-guard'

async function launchExternalEditor(launchSpec: ExternalEditorLaunchSpec): Promise<void> {
  const { spawnCmd, spawnArgs } =
    launchSpec.kind === 'executable'
      ? getSpawnArgsForWindows(launchSpec.spawnCmd, launchSpec.spawnArgs)
      : { spawnCmd: launchSpec.spawnCmd, spawnArgs: launchSpec.spawnArgs }

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(spawnCmd, spawnArgs, {
      detached: true,
      stdio: 'ignore',
      // Why: terminal editors such as nvim need a visible console on Windows;
      // GUI editor launches stay hidden to avoid command-shim flashes.
      windowsHide: launchSpec.hideWindowsConsole
    })
    let settled = false

    function cleanup(): void {
      child.off('error', onError)
      child.off('spawn', onSpawn)
    }

    function settle(callback: () => void): void {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      callback()
    }

    function onError(error: Error): void {
      settle(() => rejectPromise(error))
    }

    function onSpawn(): void {
      child.unref()
      settle(resolvePromise)
    }
    child.once('error', onError)
    child.once('spawn', onSpawn)
  })
}

export async function openInExternalEditor(
  store: Store,
  request: ShellOpenExternalEditorRequest
): Promise<ShellOpenExternalEditorResult> {
  if (hasActiveRuntime(store)) {
    return { ok: false, reason: 'remote-runtime-unsupported' }
  }

  const connectionId = request.connectionId?.trim()
  if (connectionId) {
    const sshTarget = store.getSshTarget(connectionId)
    if (!sshTarget) {
      return { ok: false, reason: 'ssh-target-not-found' }
    }
    if (sshTarget.owner?.type === 'on-demand-runtime') {
      return { ok: false, reason: 'remote-runtime-unsupported' }
    }
    if (!posix.isAbsolute(request.path) && !win32.isAbsolute(request.path)) {
      return { ok: false, reason: 'not-absolute' }
    }
    const authority = resolveVsCodeSshAuthority(sshTarget)
    if (!authority.ok) {
      return authority
    }
    const launchSpec = resolveVsCodeRemoteSshLaunchSpec(
      request.command,
      request.path,
      authority.authority
    )
    if (!launchSpec) {
      return { ok: false, reason: 'remote-editor-unsupported' }
    }
    try {
      await launchExternalEditor(launchSpec)
      return { ok: true }
    } catch {
      return { ok: false, reason: 'launch-failed' }
    }
  }

  const target = await validateLocalPathTarget(request.path)
  if (!target.ok) {
    return target
  }
  try {
    await launchExternalEditor(resolveExternalEditorLaunchSpec(request.command, target.path))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'launch-failed' }
  }
}
