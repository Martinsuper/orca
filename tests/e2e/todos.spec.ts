import type { Page } from '@stablyai/playwright-test'
import { expect, test } from './helpers/orca-app'
import { createRestartSession } from './helpers/orca-restart'
import { waitForSessionReady } from './helpers/store'

async function openTodos(page: Page, scope: 'project' | 'global' = 'project'): Promise<void> {
  await waitForSessionReady(page)
  await page.evaluate((scope) => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is not available')
    }
    store.getState().setRightSidebarTab('todos')
    store.getState().setRightSidebarOpen(true)
    store.getState().setTodoScope(scope)
  }, scope)
  await expect(
    page.getByRole('button', { name: scope === 'project' ? 'This project' : 'Global' })
  ).toBeVisible()
}

function todoTitle(page: Page, title: string) {
  return page
    .locator('p')
    .filter({ hasText: title })
    .filter({ hasText: new RegExp(`^${title}$`) })
}

function todoRow(page: Page, title: string) {
  return todoTitle(page, title).locator('..').locator('..').locator('..')
}

async function addTodo(page: Page, title: string): Promise<void> {
  const input = page.getByPlaceholder('Add a todo…')
  await expect(input).toBeVisible()
  await input.fill(title)
  await input.press('Enter')
  await expect(todoTitle(page, title)).toBeVisible()
}

async function addList(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'New list' }).click()
  const input = page.getByPlaceholder('List name')
  await expect(input).toBeVisible()
  await input.fill(title)
  await input.press('Enter')
  await expect(page.getByRole('button', { name: title })).toBeVisible()
}

async function editTodo(
  page: Page,
  title: string,
  values: { title?: string; note?: string; list?: string; myDay?: boolean }
): Promise<void> {
  await todoRow(page, title).getByLabel('Edit todo').click()
  const dialog = page.getByRole('dialog', { name: 'Edit Task' })
  await expect(dialog).toBeVisible()
  if (values.title !== undefined) {
    await dialog.locator('#todo-edit-title').fill(values.title)
  }
  if (values.note !== undefined) {
    await dialog.locator('#todo-edit-note').fill(values.note)
  }
  if (values.list !== undefined) {
    await dialog.locator('#todo-edit-list').selectOption({ label: values.list })
  }
  if (values.myDay !== undefined) {
    const myDay = dialog.locator('#todo-edit-myday')
    if ((await myDay.getAttribute('data-state')) === (values.myDay ? 'unchecked' : 'checked')) {
      await myDay.click()
    }
  }
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

test.describe('Todos', () => {
  test('retains list navigation across scopes and migrates a task to that list', async ({
    orcaPage,
    testRepoPath
  }) => {
    await openTodos(orcaPage)
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
    }, testRepoPath)

    const listTitle = 'Migration list E2E'
    const taskTitle = 'Project task migration E2E'
    await addList(orcaPage, listTitle)
    await addTodo(orcaPage, taskTitle)
    await editTodo(orcaPage, taskTitle, { list: listTitle })

    await orcaPage.getByRole('button', { name: listTitle }).click()
    await expect(orcaPage.getByText(listTitle, { exact: true }).last()).toBeVisible()
    await expect(todoTitle(orcaPage, taskTitle)).toBeVisible()

    await orcaPage.evaluate(() => window.__store?.getState().setRightSidebarTab('explorer'))
    await orcaPage.evaluate(() => window.__store?.getState().setRightSidebarTab('todos'))
    await expect(orcaPage.getByText(listTitle, { exact: true }).last()).toBeVisible()

    await orcaPage.getByRole('button', { name: 'Global' }).click()
    await expect(orcaPage.getByRole('button', { name: 'This project' })).toBeVisible()
    await orcaPage.getByRole('button', { name: 'This project' }).click()
    await expect(orcaPage.getByText(listTitle, { exact: true }).last()).toBeVisible()
    await expect(todoTitle(orcaPage, taskTitle)).toBeVisible()

    const listRow = orcaPage.getByRole('button', { name: listTitle }).locator('..')
    await listRow.getByLabel('Delete list').click()
    await listRow.getByLabel('Confirm delete').click()
    await expect(orcaPage.getByRole('button', { name: listTitle })).toHaveCount(0)
    await orcaPage.getByRole('button', { name: 'Tasks' }).click()
    await expect(todoTitle(orcaPage, taskTitle)).toBeVisible()
  })

  test('shows project and global My Day tasks together and keeps completed tasks out of All', async ({
    orcaPage,
    testRepoPath
  }, testInfo) => {
    const projectTitle = 'Project My Day E2E'
    const globalTitle = 'Global My Day E2E'

    await openTodos(orcaPage)
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
    }, testRepoPath)
    await addTodo(orcaPage, projectTitle)
    await editTodo(orcaPage, projectTitle, { myDay: true })

    await orcaPage.getByRole('button', { name: 'Global' }).click()
    await addTodo(orcaPage, globalTitle)
    await editTodo(orcaPage, globalTitle, { myDay: true })

    await orcaPage.getByRole('button', { name: 'My Day' }).click()
    await expect(todoTitle(orcaPage, projectTitle)).toBeVisible()
    await expect(todoTitle(orcaPage, globalTitle)).toBeVisible()
    await expect(todoRow(orcaPage, projectTitle)).toContainText('Project')
    await expect(todoRow(orcaPage, globalTitle)).toContainText('Global')

    await todoRow(orcaPage, projectTitle).getByLabel('Mark as done').click()
    await expect(todoTitle(orcaPage, projectTitle)).toBeHidden()
    await orcaPage.getByRole('button', { name: 'All' }).click()
    await todoRow(orcaPage, globalTitle).getByLabel('Mark as done').click()
    await expect(todoTitle(orcaPage, globalTitle)).toBeHidden()
    await orcaPage.getByRole('button', { name: 'Completed' }).click()
    await expect(todoTitle(orcaPage, globalTitle)).toBeVisible()
    await orcaPage.getByRole('button', { name: 'This project' }).click()
    await orcaPage.getByRole('button', { name: 'Completed' }).click()
    await expect(todoTitle(orcaPage, projectTitle)).toBeVisible()

    const screenshotPath = testInfo.outputPath('todos-hidden-renderer.png')
    await orcaPage.screenshot({ path: screenshotPath })
    await testInfo.attach('todos-hidden-renderer', {
      path: screenshotPath,
      contentType: 'image/png'
    })
  })

  test('persists a global task after a hidden renderer relaunch', async ({
    testRepoPath: _testRepoPath
  }, testInfo) => {
    const session = createRestartSession(testInfo)
    const taskTitle = 'Persisted global task E2E'
    try {
      const first = await session.launch()
      await openTodos(first.page, 'global')
      await addTodo(first.page, taskTitle)
      await session.close(first.app)

      const second = await session.launch()
      await openTodos(second.page, 'global')
      await expect(todoTitle(second.page, taskTitle)).toBeVisible({ timeout: 30_000 })
      await session.close(second.app)
    } finally {
      await session.dispose()
    }
  })
})
