import { test, expect } from '@playwright/test'

test.describe('Diff Viewer', () => {
  test('コミット詳細のファイルをクリックするとDiffViewerが開く', async ({ page }) => {
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
            modified: [
              { path: 'modified.txt', index: ' ', working_dir: 'M', status: 'modified' }
            ],
            untracked: [
              { path: 'new.txt', index: ' ', working_dir: '?', status: 'untracked' }
            ],
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
          getWorkingDiff: async () => [
            {
              path: 'modified.txt',
              status: 'modified',
              hunks: [
                {
                  oldStart: 1,
                  oldLines: 1,
                  newStart: 1,
                  newLines: 2,
                  lines: [
                    { type: 'header', content: '@@ -1,1 +1,2 @@' },
                    { type: 'normal', content: ' unchanged' },
                    { type: 'add', content: '+added line' }
                  ]
                }
              ]
            }
          ],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [
            {
              path: 'commit-file.txt',
              status: 'added',
              hunks: [
                {
                  oldStart: 0,
                  oldLines: 0,
                  newStart: 1,
                  newLines: 2,
                  lines: [
                    { type: 'header', content: '@@ -0,0 +1,2 @@' },
                    { type: 'add', content: '+line 1' },
                    { type: 'add', content: '+line 2' }
                  ]
                }
              ]
            }
          ],
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

    // リポジトリを開く
    await page.click('text=Open Repository')
    await expect(page.getByText('test-repo', { exact: true })).toBeVisible()

    // レンダリング完了を待つ
    await page.waitForTimeout(500)

    // CommitDetail のファイルをクリック
    await page.getByText('commit-file.txt').click()

    // Diff タブに切り替わり、diff が表示される
    await expect(page.getByRole('button', { name: 'Diff' })).toHaveClass(/border-t-blue-600/)
    await expect(page.locator('text=Test commit').first()).toBeVisible()
    await expect(page.locator('text=commit-file.txt').first()).toBeVisible()
    await expect(page.locator('text=+line 1')).toBeVisible()

    // Commit History タブをクリックして diff を閉じる
    await page.getByRole('button', { name: 'Commit History', exact: true }).click()

    // DiffViewer が閉じる
    await expect(page.locator('text=+line 1')).not.toBeVisible()
  })

  test('StatusPanel のファイルをクリックするとDiffViewerが開く', async ({ page }) => {
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
            modified: [
              { path: 'modified.txt', index: ' ', working_dir: 'M', status: 'modified' }
            ],
            untracked: [
              { path: 'new.txt', index: ' ', working_dir: '?', status: 'untracked' }
            ],
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
          getWorkingDiff: async () => [
            {
              path: 'modified.txt',
              status: 'modified',
              hunks: [
                {
                  oldStart: 1,
                  oldLines: 1,
                  newStart: 1,
                  newLines: 2,
                  lines: [
                    { type: 'header', content: '@@ -1,1 +1,2 @@' },
                    { type: 'normal', content: ' unchanged' },
                    { type: 'add', content: '+added line' }
                  ]
                }
              ]
            }
          ],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [],
          getUncommittedDiff: async () => [],
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

    // リポジトリを開く
    await page.click('text=Open Repository')
    await expect(page.getByText('test-repo', { exact: true })).toBeVisible()

    // レンダリング完了を待つ
    await page.waitForTimeout(500)

    // StatusPanel の未ステージファイルをクリック
    await page.getByText('modified.txt').last().click()

    // Diff タブに切り替わり、diff が表示される
    await expect(page.getByRole('button', { name: 'Diff' })).toHaveClass(/border-t-blue-600/)
    await expect(page.locator('text=modified.txt (Unstaged)').first()).toBeVisible()
    await expect(page.locator('text=+added line')).toBeVisible()
  })
})
