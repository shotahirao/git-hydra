import { test, expect } from '@playwright/test'
import { execSync } from 'child_process'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// テスト用Gitリポジトリを作成（ブランチ切り替えスクロール用）
function createTestRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'git-hydra-test-'))
  execSync('git init', { cwd: dir })
  execSync('git config user.email "test@test.com"', { cwd: dir })
  execSync('git config user.name "Test User"', { cwd: dir })

  // mainブランチに50個のコミットを作成
  for (let i = 0; i < 50; i++) {
    writeFileSync(join(dir, `file${i}.txt`), `content ${i}`)
    execSync(`git add file${i}.txt`, { cwd: dir })
    execSync(`git commit -m "Commit ${i}: ${'x'.repeat(20)}"`, { cwd: dir })
  }

  // featureブランチを作成し、さらに20個のコミットを追加
  execSync('git checkout -b feature', { cwd: dir })
  for (let i = 50; i < 70; i++) {
    writeFileSync(join(dir, `feature${i}.txt`), `feature content ${i}`)
    execSync(`git add feature${i}.txt`, { cwd: dir })
    execSync(`git commit -m "Feature commit ${i}: ${'y'.repeat(20)}"`, { cwd: dir })
  }

  // mainに戻る
  execSync('git checkout main', { cwd: dir })

  return dir
}

test.describe('Branch Checkout Scroll', () => {
  let repoPath: string

  test.beforeEach(() => {
    repoPath = createTestRepo()
  })

  test('ブランチ切り替え時に変更したブランチのHEADコミットが表示される', async ({ page }) => {
    const allCommits = []
    for (let i = 69; i >= 0; i--) {
      const isFeature = i >= 50
      const prefix = isFeature ? 'Feature commit' : 'Commit'
      const parents = i === 0 ? [] : [`hash${(i - 1).toString().padStart(2, '0')}`]
      let refs = ''
      if (i === 69) refs = 'HEAD -> feature'
      else if (i === 49) refs = 'HEAD -> main'
      allCommits.push({
        hash: `hash${i.toString().padStart(2, '0')}`,
        message: `${prefix} ${i}`,
        author_name: 'Test',
        author_email: 'test@test.com',
        date: '2024-01-01T00:00:00Z',
        parents,
        refs
      })
    }

    await page.addInitScript(({ repoPath, allCommits }) => {
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
            { name: 'main', current: true, label: 'main' },
            { name: 'feature', current: false, label: 'feature' }
          ],
          getLog: async () => allCommits,
          getDiff: async () => [],
          getWorkingDiff: async () => [],
          getStagedDiff: async () => [],
          getCommitDiff: async () => [],
          stage: async () => {},
          unstage: async () => {},
          commit: async () => '',
          checkout: async (targetRepoPath: string, branchName: string) => {
            // モック: ブランチ切り替え後のステータスを変更
            // @ts-ignore
            window.electronAPI.git.getStatus = async () => ({
              current: branchName,
              ahead: 0,
              behind: 0,
              staged: [],
              modified: [],
              untracked: [],
              conflicted: []
            })
            // @ts-ignore
            window.electronAPI.git.getLog = async () => {
              const commits = []
              for (let i = 69; i >= 0; i--) {
                const isFeature = i >= 50
                const prefix = isFeature ? 'Feature commit' : 'Commit'
                const parents = i === 0 ? [] : [`hash${(i - 1).toString().padStart(2, '0')}`]
                let refs = ''
                if (i === 69 && branchName === 'feature') refs = 'HEAD -> feature'
                else if (i === 49 && branchName === 'main') refs = 'HEAD -> main'
                commits.push({
                  hash: `hash${i.toString().padStart(2, '0')}`,
                  message: `${prefix} ${i}`,
                  author_name: 'Test',
                  author_email: 'test@test.com',
                  date: '2024-01-01T00:00:00Z',
                  parents,
                  refs
                })
              }
              return commits
            }
            // @ts-ignore
            window.electronAPI.git.getBranches = async () => [
              { name: 'main', current: branchName === 'main', label: 'main' },
              { name: 'feature', current: branchName === 'feature', label: 'feature' }
            ]
          },
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
    }, { repoPath, allCommits })

    await page.goto('http://localhost:1420')

    // Open Repositoryボタンをクリック
    await page.click('text=Open Repository')

    // リポジトリが開くのを待つ
    await page.waitForSelector('text=Commit History')

    // requestAnimationFrame待機
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

    // visible なコミット要素から祖先のスクロールコンテナを特定
    const commitElement = page.locator('#commit-row-hash49:visible')
    const scrollContainer = commitElement.locator('xpath=ancestor::*[contains(@class, "overflow-y-auto")]')

    // mainブランチが選択されている状態のスクロール位置を確認
    const mainScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    console.log('Main branch scrollTop:', mainScrollTop)

    // mainのHEADはhash49（インデックス上では20番目=69-49=20、0-indexedなので20番目）
    // スクロール位置は0ではないはず（HEADコミットが中央に表示されるようにスクロールされる）
    // ただしmainブランチのHEADは比較的古い位置にある

    // featureブランチをクリックしてチェックアウト
    const featureBranchButton = page.locator('text=feature').first()
    await featureBranchButton.click()

    // ブランチ切り替え後のスクロール位置を確認
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await page.waitForTimeout(500)
    const featureScrollTop = await scrollContainer.evaluate(el => el.scrollTop)
    console.log('Feature branch scrollTop:', featureScrollTop)

    // featureブランチのHEADはhash69（最新）で、これはリストの最上部
    // スクロール位置が小さくなっていることを確認（上にスクロールされる）
    expect(featureScrollTop).toBeLessThan(mainScrollTop)

    // hash69の要素がビューポート内にあることを確認
    const headCommitElement = page.locator('#commit-row-hash69:visible')
    const isVisible = await headCommitElement.isVisible()
    expect(isVisible).toBe(true)

    // hash69が中央付近にあることを確認（要素の上端がコンテナの高さの1/4～3/4の範囲にある）
    const containerRect = await scrollContainer.evaluate(el => el.getBoundingClientRect())
    const elementRect = await headCommitElement.evaluate(el => el.getBoundingClientRect())
    const relativeTop = elementRect.top - containerRect.top
    console.log('Head commit relative top:', relativeTop)
    expect(relativeTop).toBeGreaterThan(-10)
    expect(relativeTop).toBeLessThan(containerRect.height + 10)
  })
})
