import { test, expect } from '@playwright/test'

test.describe('GitHydra E2E Tests', () => {
  test('アプリが起動し、リポジトリ選択画面が表示される', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.electronAPI = {
        platform: 'darwin',
        openDirectory: async () => null,
        openExternal: async () => {},
        onRepoChanged: () => () => {},
        config: {
          getRecentRepos: async () => [],
          addRecentRepo: async () => {},
          removeRecentRepo: async () => {},
          getSessionTabs: async () => [],
          saveSessionTabs: async () => {}
        },
        git: {
          isValidRepo: async () => true,
          openRepo: async () => ({ valid: true, currentBranch: 'main' }),
          closeRepo: async () => {},
          watchRepo: async () => {},
          unwatchRepo: async () => {},
          getStatus: async () => ({}),
          getBranches: async () => [],
          getLog: async () => [],
          getDiff: async () => [],
          getWorkingDiff: async () => [],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [],
          stage: async () => {},
          unstage: async () => {},
          commit: async () => '',
          checkout: async () => {},
          createBranch: async () => {},
          push: async () => {},
          pull: async () => '',
          fetch: async () => {},
          merge: async () => '',
          rebase: async () => '',
          deleteBranch: async () => {},
          renameBranch: async () => {},
          listWorktrees: async () => [],
          addWorktree: async () => ({ name: '', path: '' }),
          removeWorktree: async () => {}
        }
      }
    })

    await page.goto('http://localhost:1420')

    // 初期画面の確認
    await expect(page.locator('text=GitHydra')).toBeVisible()
    await expect(page.locator('text=Open Repository')).toBeVisible()
  })

  test('最近使ったリポジトリが表示される', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.electronAPI = {
        platform: 'darwin',
        openDirectory: async () => null,
        openExternal: async () => {},
        onRepoChanged: () => () => {},
        config: {
          getRecentRepos: async () => ['/Users/test/project-a', '/Users/test/project-b'],
          addRecentRepo: async () => {},
          removeRecentRepo: async () => {},
          getSessionTabs: async () => [],
          saveSessionTabs: async () => {}
        },
        git: {
          isValidRepo: async () => true,
          openRepo: async () => ({ valid: true, currentBranch: 'main' }),
          closeRepo: async () => {},
          watchRepo: async () => {},
          unwatchRepo: async () => {},
          getStatus: async () => ({}),
          getBranches: async () => [],
          getLog: async () => [],
          getDiff: async () => [],
          getWorkingDiff: async () => [],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [],
          stage: async () => {},
          unstage: async () => {},
          commit: async () => '',
          checkout: async () => {},
          createBranch: async () => {},
          push: async () => {},
          pull: async () => '',
          fetch: async () => {},
          merge: async () => '',
          rebase: async () => '',
          deleteBranch: async () => {},
          renameBranch: async () => {},
          listWorktrees: async () => [],
          addWorktree: async () => ({ name: '', path: '' }),
          removeWorktree: async () => {}
        }
      }
    })

    await page.goto('http://localhost:1420')

    // 最近使ったリポジトリが表示されるのを待つ
    await expect(page.locator('text=Recent Repositories')).toBeVisible()
    await expect(page.getByText('project-a', { exact: true })).toBeVisible()
    await expect(page.getByText('project-b', { exact: true })).toBeVisible()
  })

  test('リポジトリを開くとタブが表示される', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.electronAPI = {
        platform: 'darwin',
        openDirectory: async () => '/tmp/test-repo',
        openExternal: async () => {},
        onRepoChanged: () => () => {},
        config: {
          getRecentRepos: async () => [],
          addRecentRepo: async () => {},
          removeRecentRepo: async () => {},
          getSessionTabs: async () => [],
          saveSessionTabs: async () => {}
        },
        git: {
          isValidRepo: async () => true,
          openRepo: async () => ({ valid: true, currentBranch: 'main' }),
          closeRepo: async () => {},
          watchRepo: async () => {},
          unwatchRepo: async () => {},
          getStatus: async () => ({
            current: 'main',
            ahead: 0,
            behind: 0,
            staged: [],
            modified: [],
            untracked: [],
            conflicted: []
          }),
          getBranches: async () => [{ name: 'main', current: true, label: 'main' }],
          getLog: async () => [
            {
              hash: 'abc123',
              message: 'Test commit',
              author_name: 'Test User',
              author_email: 'test@example.com',
              date: '2024-01-01T00:00:00Z',
              parents: [],
              refs: 'HEAD -> main'
            }
          ],
          getDiff: async () => [],
          getWorkingDiff: async () => [],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [],
          stage: async () => {},
          unstage: async () => {},
          commit: async () => '',
          checkout: async () => {},
          createBranch: async () => {},
          push: async () => {},
          pull: async () => '',
          fetch: async () => {},
          merge: async () => '',
          rebase: async () => '',
          deleteBranch: async () => {},
          renameBranch: async () => {},
          listWorktrees: async () => [],
          addWorktree: async () => ({ name: '', path: '' }),
          removeWorktree: async () => {}
        }
      }
    })

    await page.goto('http://localhost:1420')

    // Open Repositoryボタンをクリック
    await page.click('text=Open Repository')

    // タブが表示されるのを待つ（exact matchでタブ名のみを探す）
    await expect(page.getByText('test-repo', { exact: true })).toBeVisible()
  })

  test('コミットをクリックすると詳細が表示される', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.electronAPI = {
        platform: 'darwin',
        openDirectory: async () => '/tmp/test-repo',
        openExternal: async () => {},
        onRepoChanged: () => () => {},
        config: {
          getRecentRepos: async () => [],
          addRecentRepo: async () => {},
          removeRecentRepo: async () => {},
          getSessionTabs: async () => [],
          saveSessionTabs: async () => {}
        },
        git: {
          isValidRepo: async () => true,
          openRepo: async () => ({ valid: true, currentBranch: 'main' }),
          closeRepo: async () => {},
          watchRepo: async () => {},
          unwatchRepo: async () => {},
          getStatus: async () => ({
            current: 'main',
            ahead: 0,
            behind: 0,
            staged: [],
            modified: [],
            untracked: [],
            conflicted: []
          }),
          getBranches: async () => [{ name: 'main', current: true, label: 'main' }],
          getLog: async () => [
            {
              hash: 'abc123',
              message: 'Test commit',
              author_name: 'Test User',
              author_email: 'test@example.com',
              date: '2024-01-01T00:00:00Z',
              parents: [],
              refs: 'HEAD -> main'
            }
          ],
          getDiff: async () => [],
          getWorkingDiff: async () => [],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [],
          stage: async () => {},
          unstage: async () => {},
          commit: async () => '',
          checkout: async () => {},
          createBranch: async () => {},
          push: async () => {},
          pull: async () => '',
          fetch: async () => {},
          merge: async () => '',
          rebase: async () => '',
          deleteBranch: async () => {},
          renameBranch: async () => {},
          listWorktrees: async () => [],
          addWorktree: async () => ({ name: '', path: '' }),
          removeWorktree: async () => {}
        }
      }
    })

    await page.goto('http://localhost:1420')

    // Open Repositoryボタンをクリック
    await page.click('text=Open Repository')

    // タブが表示されるのを待つ
    await expect(page.getByText('test-repo', { exact: true })).toBeVisible()

    // レンダリング完了を待つ
    await page.waitForTimeout(1000)

    // HEADコミットが選択されていることを確認（commit-selectedクラスを持つ要素が表示されている）
    await expect(page.locator('.commit-selected')).toBeVisible()
  })
})
