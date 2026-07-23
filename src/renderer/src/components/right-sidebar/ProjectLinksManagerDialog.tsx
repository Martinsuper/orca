import { useEffect, useMemo, useState } from 'react'
import { Link2, Loader2, Pencil, Trash2, ExternalLink, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { useAppStore } from '@/store'
import { useMountedRef } from '@/hooks/useMountedRef'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { ProjectLink } from '../../../../shared/types'

type ProjectLinksManagerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string
  /** Prefill the "add link" form's category (e.g. the folder a user right-clicked). */
  initialCategory?: string
  /** 'manage' shows the existing-links list + form; 'add' shows only the form. */
  mode?: 'manage' | 'add'
}

export function ProjectLinksManagerDialog({
  open,
  onOpenChange,
  repoId,
  initialCategory,
  mode = 'manage'
}: ProjectLinksManagerDialogProps): React.JSX.Element {
  const mountedRef = useMountedRef()
  const links = useAppStore((s) => s.projectLinksByRepo[repoId])
  const saveProjectLink = useAppStore((s) => s.saveProjectLink)
  const removeProjectLink = useAppStore((s) => s.removeProjectLink)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Why: when opened from a folder's right-click "new link", prefill that
  // category so the link lands where the user asked. Only on open, and only
  // when not editing an existing link.
  useEffect(() => {
    if (open && !editingId && initialCategory !== undefined) {
      setCategory(initialCategory)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = useMemo(() => {
    const uncategorized = translate(
      'auto.components.right.sidebar.projectLinks.uncategorized',
      'Uncategorized'
    )
    return groupLinksByCategory(links ?? [], uncategorized)
  }, [links])

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
      const saved = await saveProjectLink({
        repoId,
        ...(editingId ? { id: editingId } : {}),
        name: name.trim(),
        url: url.trim(),
        category: category.trim()
      })
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
      await removeProjectLink({ repoId, linkId: link.id })
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
              ? translate('auto.components.right.sidebar.projectLinks.newLink', 'New link')
              : translate(
                  'auto.components.right.sidebar.projectLinks.manageTitle',
                  'Project Links'
                )}
          </DialogTitle>
        </DialogHeader>

        {mode !== 'add' && (
          <div className="scrollbar-sleek -mr-2 flex max-h-[42vh] flex-col gap-4 overflow-y-auto pr-2">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Link2 className="size-7 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {translate(
                    'auto.components.right.sidebar.projectLinks.emptyManaged',
                    'No links yet. Add your first one below.'
                  )}
                </p>
              </div>
            ) : (
              grouped.map((group) => (
                <div key={group.category} className="flex flex-col gap-1">
                  <div className="border-b border-border/40 pb-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    {group.category.split('/').join(' / ')}
                  </div>
                  {group.links.map((link) => {
                    const confirming = confirmingDeleteId === link.id
                    const isDeleting = deletingId === link.id
                    return (
                      <div
                        key={link.id}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors hover:border-border/50 hover:bg-accent/40',
                          editingId === link.id && 'border-border bg-accent'
                        )}
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                          <Link2 className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{link.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {linkHost(link.url)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void window.api.shell.openUrl(link.url)}
                            aria-label={translate(
                              'auto.components.right.sidebar.projectLinks.open',
                              'Open link'
                            )}
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => beginEdit(link)}
                            disabled={isDeleting}
                            aria-label={translate(
                              'auto.components.right.sidebar.projectLinks.edit',
                              'Edit link'
                            )}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant={confirming ? 'destructive' : 'ghost'}
                            size="sm"
                            onClick={() => void handleDelete(link)}
                            onBlur={() => setConfirmingDeleteId(null)}
                            disabled={isDeleting}
                            className={cn(
                              'w-[5.5rem] px-2 text-xs',
                              !confirming && 'text-muted-foreground'
                            )}
                            aria-label={translate(
                              'auto.components.right.sidebar.projectLinks.delete',
                              'Delete link'
                            )}
                          >
                            {isDeleting ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                            {confirming
                              ? translate(
                                  'auto.components.right.sidebar.projectLinks.confirm',
                                  'Confirm'
                                )
                              : translate(
                                  'auto.components.right.sidebar.projectLinks.delete',
                                  'Delete'
                                )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
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

type ProjectLinkGroup = { category: string; links: ProjectLink[] }

function linkHost(rawUrl: string): string {
  // Why: the host reads cleaner than a full URL in a dense row; fall back to the
  // raw string when it isn't a parseable absolute URL.
  try {
    return new URL(rawUrl).host || rawUrl
  } catch {
    return rawUrl
  }
}

function groupLinksByCategory(links: ProjectLink[], uncategorized: string): ProjectLinkGroup[] {
  const byCategory = new Map<string, ProjectLink[]>()
  for (const link of links) {
    const key = link.category.trim() || uncategorized
    const bucket = byCategory.get(key)
    if (bucket) {
      bucket.push(link)
    } else {
      byCategory.set(key, [link])
    }
  }
  return [...byCategory.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, groupLinks]) => ({ category, links: groupLinks }))
}
