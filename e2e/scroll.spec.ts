import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// テスト用Gitリポジトリを作成
function createTestRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-hydra-test-'))
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test User"', { cwd: dir })
  
  // 50個のコミットを作成（スクロールテスト用）
  for (let i = 0; i < 50; i++) {
    writeFileSync(join(dir, `file${i}.txt`), `content ${i}`)
    execSync(`git add file${i}.txt`, { cwd: dir })
    execSync(`git commit -m "Commit ${i}: ${'x'.repeat(20)}"`, { cwd: dir })
  }
  
  return dir
}

test.describe('CommitGraph Scroll', () => {
  let repoPath: string

  test.beforeEach(() => {
    repoPath = createTestRepo()
  })

  test('コミット選択時にスクロールされる', async ({ page }) => {
    // git log order: newest first
    const commits = []
    for (let i = 49; i >= 0; i--) {
      commits.push({
        hash: `hash${i.toString().padStart(2, '0')}`,
        message: `Commit ${i}`,
        author_name: 'Test',
        author_email: 'test@test.com',
        date: '2024-01-01T00:00:00Z',
        parents: i === 0 ? [] : [`hash${(i-1).toString().padStart(2, '0')}`],
        refs: i === 49 ? 'HEAD -> main' : ''
      })
    }

    await page.addInitScript(({ repoPath, commits }) => {
      // @ts-ignore
      window.electronAPI = {
        platform: 'darwin',
        openDirectory: async () => repoPath,
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
          getBranches: async () => [
            { name: 'main', current: true, label: 'main' }
          ],
          getLog: async () => commits,
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
    }, { repoPath, commits })

    await page.goto('http://localhost:1420')
    
    // Open Repositoryボタンをクリック
    await page.click('text=Open Repository')
    
    // リポジトリが開くのを待つ
    await page.waitForSelector('text=Commit History')

    // Wait for React render + rAF scroll
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.waitForTimeout(200)

    // visible なコミット要素から祖先のスクロールコンテナを特定
    const commitElement = page.locator('#commit-row-hash49:visible')
    const scrollContainer = commitElement.locator('xpath=ancestor::*[contains(@class, "overflow-y-auto")]')

    // 初期状態：HEADコミット（hash49, newest）が選択されている
    // hash49 is at the top of the list, so scrollTop should be 0
    const initialScrollTop = await scrollContainer.evaluate(el => el.scrollTop)

    console.log('Initial scrollTop:', initialScrollTop)
    expect(initialScrollTop).toBe(0)

    // 最後のコミット（hash00, oldest at bottom）をクリック
    const lastCommit = page.locator('#commit-row-hash00:visible')
    await lastCommit.click()

    // Wait for React render + rAF scroll
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.waitForTimeout(200)
    const afterClickScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    console.log('After click scrollTop:', afterClickScrollTop)

    // 下にスクロールされることを確認
    expect(afterClickScrollTop).toBeGreaterThan(initialScrollTop)
  })
})
