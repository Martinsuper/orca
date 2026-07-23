import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { translate } from '@/i18n/i18n'

type ProjectLinkFolderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string
  /** Parent folder path the new folder nests under; empty string = top level. */
  parentPath: string
}

export function ProjectLinkFolderDialog({
  open,
  onOpenChange,
  repoId,
  parentPath
}: ProjectLinkFolderDialogProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const addProjectLinkFolder = useAppStore((s) => s.addProjectLinkFolder)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
    }
  }, [open])

  const close = (): void => onOpenChange(false)

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || submitting) {
      return
    }
    const path = parentPath ? `${parentPath}/${trimmed}` : trimmed
    setSubmitting(true)
    try {
      await addProjectLinkFolder({ repoId, path })
      if (mountedRef.current) {
        close()
      }
    } catch {
      // Why: the slice surfaces failure via toast and rolls back optimistic state.
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close()
        }
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {translate('auto.components.right.sidebar.projectLinks.newFolderTitle', 'New Folder')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label htmlFor="project-link-folder-name" className="text-xs text-muted-foreground">
              {parentPath
                ? translate(
                    'auto.components.right.sidebar.projectLinks.newSubfolderUnder',
                    'New folder under “{{value0}}”',
                    { value0: parentPath.split('/').join(' / ') }
                  )
                : translate(
                    'auto.components.right.sidebar.projectLinks.folderNameLabel',
                    'Folder name'
                  )}
            </Label>
            <Input
              id="project-link-folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={translate(
                'auto.components.right.sidebar.projectLinks.folderNamePlaceholder',
                'Production'
              )}
              maxLength={40}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={close}>
              {translate('auto.components.right.sidebar.projectLinks.cancel', 'Cancel')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || submitting}
              className="w-[5rem]"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                translate('auto.components.right.sidebar.projectLinks.create', 'Create')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
