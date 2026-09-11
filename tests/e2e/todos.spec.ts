import { expect, test } from './helpers/orca-app'
import { waitForSessionReady } from './helpers/store'

test.describe('Todos', () => {
  test('manages project and global todos from the right sidebar', async ({
    orcaPage,
    testRepoPath
  }) => {
    await waitForSessionReady(orcaPage)
    await orcaPage.evaluate(async (repoPath) => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is not available')
      }
      await store.getState().fetchRepos()
      const repo = store.getState().repos.find((entry) => entry.path === repoPath)
      if (!repo) {
        throw new Error(`Seeded E2E repo was not registered: ${repoPath}`)
      }
      await store.getState().fetchWorktrees(repo.id)
      const worktree = (store.getState().worktreesByRepo[repo.id] ?? []).find(
        (entry) => entry.path === repoPath
      )
      if (!worktree) {
        throw new Error(`Seeded E2E worktree was not registered: ${repoPath}`)
      }
      store.getState().setActiveRepo(repo.id)
      store.getState().setActiveWorktree(worktree.id)
      store.getState().setRightSidebarTab('todos')
      store.getState().setRightSidebarOpen(true)
    }, testRepoPath)

    const addTodo = orcaPage.getByPlaceholder('Add a todo…')
    await expect(addTodo).toBeVisible({ timeout: 10_000 })

    const projectTitle = 'Project todo E2E'
    await addTodo.fill(projectTitle)
    await addTodo.press('Enter')
    await expect(orcaPage.locator('p').filter({ hasText: projectTitle })).toBeVisible()

    await orcaPage.getByLabel('Mark as done').click()
    await expect(orcaPage.getByLabel('Mark as not done')).toBeVisible()

    await orcaPage.getByLabel('Edit todo').click()
    const editor = orcaPage.getByText('Edit Todo').locator('..')
    await editor.locator('input').fill('Updated project todo E2E')
    await editor.locator('textarea').fill('Project todo note')
    await editor.getByRole('button', { name: 'Save' }).click()
    await expect(
      orcaPage.locator('p').filter({ hasText: 'Updated project todo E2E' })
    ).toBeVisible()
    await expect(orcaPage.locator('p').filter({ hasText: 'Project todo note' })).toBeVisible()

    await orcaPage.getByRole('button', { name: 'Global' }).click()
    await expect(addTodo).toBeVisible()
    const globalTitle = 'Global todo E2E'
    await addTodo.fill(globalTitle)
    await addTodo.press('Enter')
    await expect(orcaPage.locator('p').filter({ hasText: globalTitle })).toBeVisible()

    const updatedTodo = orcaPage.locator('p').filter({ hasText: 'Updated project todo E2E' })
    await orcaPage.getByRole('button', { name: 'This project' }).click()
    await expect(updatedTodo).toBeVisible()
    await orcaPage.getByLabel('Delete todo').click()
    await orcaPage.getByLabel('Confirm delete').click()
    await expect(updatedTodo).toBeHidden()
  })
})
