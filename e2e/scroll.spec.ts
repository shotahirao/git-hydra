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
    await page.goto('http://localhost:5173')
    
    // テスト用リポジトリを開く（IPCをモック）
    await page.evaluate((path) => {
      // @ts-ignore
      window.electronAPI = {
        openDirectory: async () => path,
        git: {
          openRepo: async () => ({ valid: true, currentBranch: 'main' }),
          getBranches: async () => [
            { name: 'main', current: true, label: 'main' }
          ],
          getLog: async () => {
            const commits = []
            for (let i = 0; i < 50; i++) {
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
            return commits
          },
          getStatus: async () => ({
            current: 'main',
            ahead: 0,
            behind: 0,
            staged: [],
            modified: [],
            untracked: [],
            conflicted: []
          }),
          getCommitDiff: async () => []
        }
      }
    }, repoPath)
    
    // Open Repositoryボタンをクリック
    await page.click('text=Open Repository')
    
    // リポジトリが開くのを待つ
    await page.waitForSelector('text=Commit History')
    
    // 初期状態：HEADコミット（最後のコミット、index 49）が選択されている
    // スクロール位置を確認
    const scrollContainer = page.locator('.overflow-y-auto').first()
    const initialScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    
    console.log('Initial scrollTop:', initialScrollTop)
    
    // スクロールが発生していることを確認（0より大きい）
    // 最後のコミットが中央に表示されるようにスクロールされるはず
    expect(initialScrollTop).toBeGreaterThan(0)
    
    // 最初のコミットをクリック
    const firstCommit = page.locator('#commit-row-hash00')
    await firstCommit.click()
    
    // スクロール位置が0に近くなることを確認
    await page.waitForTimeout(500)
    const afterClickScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    console.log('After click scrollTop:', afterClickScrollTop)
    
    expect(afterClickScrollTop).toBeLessThan(initialScrollTop)
  })
})
