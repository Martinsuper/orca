import { posix, win32 } from 'node:path'
import type {
  ShellOpenExternalEditorRequest,
  ShellOpenExternalEditorResult
} from '../../shared/shell-open-types'
import type { Store } from '../persistence'
import {
  launchExternalEditor,
  resolveExternalEditorLaunchSpec,
  resolveVsCodeRemoteSshLaunchSpec
} from '../external-editor-launch'
import { resolveVsCodeSshAuthority } from '../ssh/vscode-ssh-authority'
import { isLocallyOwned, validateLocalPathTarget } from './shell-local-path-guard'
import { toSshExecutionHostId } from '../../shared/execution-host'

export async function openInExternalEditor(
  store: Store,
  request: ShellOpenExternalEditorRequest
): Promise<ShellOpenExternalEditorResult> {
  const connectionId = request.connectionId?.trim()
  if (connectionId) {
    if (request.ownerHostId !== toSshExecutionHostId(connectionId)) {
      return { ok: false, reason: 'remote-runtime-unsupported' }
    }
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

  if (!isLocallyOwned(request.ownerHostId)) {
    return { ok: false, reason: 'remote-runtime-unsupported' }
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
