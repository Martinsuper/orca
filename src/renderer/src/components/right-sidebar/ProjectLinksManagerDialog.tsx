import { useEffect, useState } from 'react'
import { Globe, Link2, Loader2, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { ProjectLink } from '../../../../shared/types'
import type { LinkScope } from './LinksPanelRows'
import { ProjectLinksManagerList } from './ProjectLinksManagerList'

type ProjectLinksManagerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string
  /** Prefill the "add link" form's category (e.g. the folder a user right-clicked). */
  initialCategory?: string
  /** Which store the dialog opens on; default 'local'. */
  initialScope?: LinkScope
  /** 'manage' shows the existing-links list + form; 'add' shows only the form. */
  mode?: 'manage' | 'add'
}

export function ProjectLinksManagerDialog({
  open,
  onOpenChange,
  repoId,
  initialCategory,
  initialScope = 'local',
  mode = 'manage'
}: ProjectLinksManagerDialogProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const localLinks = useAppStore((s) => s.projectLinksByRepo[repoId])
  const globalLinks = useAppStore((s) => s.globalProjectLinks)
  const saveProjectLink = useAppStore((s) => s.saveProjectLink)
  const removeProjectLink = useAppStore((s) => s.removeProjectLink)
  const saveGlobalProjectLink = useAppStore((s) => s.saveGlobalProjectLink)
  const removeGlobalProjectLink = useAppStore((s) => s.removeGlobalProjectLink)
  const fetchGlobalProjectLinks = useAppStore((s) => s.fetchGlobalProjectLinks)

  const [scope, setScope] = useState<LinkScope>(initialScope)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Why: pull global links lazily so the Global tab renders correctly the first
  // time it's opened without piggybacking on the panel's own fetch.
  useEffect(() => {
    if (open && scope === 'global' && globalLinks === undefined) {
      void fetchGlobalProjectLinks()
    }
  }, [open, scope, globalLinks, fetchGlobalProjectLinks])

  // Why: when opened from a folder's right-click "new link", prefill that
  // category so the link lands where the user asked. Only on open, and only
  // when not editing an existing link.
  useEffect(() => {
    if (open && !editingId && initialCategory !== undefined) {
      setCategory(initialCategory)
    }
    if (open) {
      setScope(initialScope)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const links = scope === 'global' ? globalLinks : localLinks

  const resetForm = (): void => {
    setEditingId(null)
    setName('')
    setUrl('')
    setCategory('')
  }

  const beginEdit = (link: ProjectLink): void => {
    setConfirmingDeleteId(null)
    setEditingId(link.id)
    setName(link.name)
    setUrl(link.url)
    setCategory(link.category)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!name.trim() || !url.trim() || submitting) {
      return
    }
    setSubmitting(true)
    try {
      const args = {
        ...(editingId ? { id: editingId } : {}),
        name: name.trim(),
        url: url.trim(),
        category: category.trim()
      }
      const saved =
        scope === 'global'
          ? await saveGlobalProjectLink(args)
          : await saveProjectLink({ repoId, ...args })
      if (!mountedRef.current) {
        return
      }
      if (saved) {
        resetForm()
        // Why: the add-only dialog is a one-shot "new link" flow — close on
        // success. The manage dialog stays open so the user can keep editing.
        if (mode === 'add') {
          onOpenChange(false)
        }
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  const handleDelete = async (link: ProjectLink): Promise<void> => {
    // Why: mirror the sparse-preset row's two-step confirm so a stray click
    // never destroys a saved link — first click arms, second click commits.
    if (confirmingDeleteId !== link.id) {
      setConfirmingDeleteId(link.id)
      return
    }
    setDeletingId(link.id)
    try {
      await (scope === 'global'
        ? removeGlobalProjectLink({ linkId: link.id })
        : removeProjectLink({ repoId, linkId: link.id }))
      if (mountedRef.current) {
        setConfirmingDeleteId(null)
        if (editingId === link.id) {
          resetForm()
        }
      }
    } catch {
      // Why: slice already surfaces the failure via toast and restores state.
      if (mountedRef.current) {
        setConfirmingDeleteId(link.id)
      }
    } finally {
      if (mountedRef.current) {
        setDeletingId(null)
      }
    }
  }

  const closeDialog = (): void => {
    resetForm()
    setConfirmingDeleteId(null)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {mode === 'add'
              ? scope === 'global'
                ? translate(
                    'auto.components.right.sidebar.projectLinks.newGlobalLink',
                    'New global link'
                  )
                : translate('auto.components.right.sidebar.projectLinks.newLink', 'New link')
              : translate(
                  'auto.components.right.sidebar.projectLinks.manageTitle',
                  'Project Links'
                )}
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={scope}
          onValueChange={(next) => {
            if (next === 'local' || next === 'global') {
              // Why: switching tabs discards a half-typed row so the form
              // reflects the tab's list. Editing state is scope-specific too.
              resetForm()
              setScope(next)
            }
          }}
        >
          <TabsList className="mb-2">
            <TabsTrigger value="local">
              <Link2 className="size-3.5" />
              {translate('auto.components.right.sidebar.projectLinks.localTab', 'This project')}
            </TabsTrigger>
            <TabsTrigger value="global">
              <Globe className="size-3.5" />
              {translate('auto.components.right.sidebar.projectLinks.globalTab', 'Global')}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode !== 'add' && (
          <div className="scrollbar-sleek -mr-2 flex max-h-[42vh] flex-col gap-4 overflow-y-auto pr-2">
            <ProjectLinksManagerList
              confirmingDeleteId={confirmingDeleteId}
              deletingId={deletingId}
              editingId={editingId}
              links={links ?? []}
              onDelete={(link) => void handleDelete(link)}
              onDeleteBlur={() => setConfirmingDeleteId(null)}
              onEdit={beginEdit}
            />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className={cn('flex flex-col gap-3', mode !== 'add' && 'border-t border-border pt-4')}
        >
          {mode !== 'add' && (
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {editingId
                  ? translate(
                      'auto.components.right.sidebar.projectLinks.editingHeader',
                      'Edit link'
                    )
                  : translate('auto.components.right.sidebar.projectLinks.addHeader', 'Add link')}
              </span>
              {editingId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={resetForm}
                  aria-label={translate(
                    'auto.components.right.sidebar.projectLinks.cancelEdit',
                    'Cancel edit'
                  )}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="project-link-name" className="text-xs text-muted-foreground">
                {translate('auto.components.right.sidebar.projectLinks.nameLabel', 'Name')}
              </Label>
              <Input
                id="project-link-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={translate(
                  'auto.components.right.sidebar.projectLinks.namePlaceholderShort',
                  'Prod dashboard'
                )}
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="project-link-category" className="text-xs text-muted-foreground">
                {translate('auto.components.right.sidebar.projectLinks.categoryLabel', 'Category')}
              </Label>
              <Input
                id="project-link-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder={translate(
                  'auto.components.right.sidebar.projectLinks.categoryPlaceholderNested',
                  'Production/Database'
                )}
                maxLength={40}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="project-link-url" className="text-xs text-muted-foreground">
              {translate('auto.components.right.sidebar.projectLinks.urlLabel', 'URL')}
            </Label>
            <Input
              id="project-link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={translate(
                'auto.components.right.sidebar.projectLinks.urlPlaceholder',
                'https://example.com'
              )}
              maxLength={2048}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {translate(
              'auto.components.right.sidebar.projectLinks.categoryHint',
              'Tip: use “/” in a category to create nested submenus, e.g. Production/Database.'
            )}
          </p>
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || !url.trim() || submitting}
              className="w-[6rem]"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : editingId ? (
                translate('auto.components.right.sidebar.projectLinks.save', 'Save')
              ) : (
                translate('auto.components.right.sidebar.projectLinks.add', 'Add')
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
