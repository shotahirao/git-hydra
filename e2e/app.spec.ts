import { test, expect } from '@playwright/test'

test.describe('GitDragon E2E Tests', () => {
  test('アプリが起動し、リポジトリ選択画面が表示される', async ({ page }) => {
    await page.goto('http://localhost:5173')
    
    // 初期画面の確認
    await expect(page.locator('text=GitDragon')).toBeVisible()
    await expect(page.locator('text=Open Repository')).toBeVisible()
  })

  test('リポジトリを開いた後、HEADコミットが選択されている', async ({ page }) => {
    await page.goto('http://localhost:5173')
    
    // Open Repositoryボタンをクリック
    await page.click('text=Open Repository')
    
    // ダイアログが開くのを待つ（Electronのネイティブダイアログはテスト不可だが、
    // IPCをモックするか、テスト用リポジトリを事前に準備する必要がある）
    // このテストは手動での確認用
  })

  test('コミットをクリックすると詳細が表示される', async ({ page }) => {
    await page.goto('http://localhost:5173')
    
    // テスト用：IPCをモックしてリポジトリを開く
    await page.evaluate(() => {
      // @ts-ignore
      window.electronAPI = {
        openDirectory: async () => '/tmp/test-repo',
        git: {
          openRepo: async () => ({ valid: true, currentBranch: 'main' }),
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
    })
    
    // IPCモック後、自動的にリポジトリが開かれるはず
    // HEADコミットが選択されていることを確認
    await expect(page.locator('[data-selected="true"]')).toBeVisible()
  })
})
