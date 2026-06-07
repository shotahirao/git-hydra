import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const RECENT_REPOS_FILE = 'recent-repos.json'
const SESSION_TABS_FILE = 'session-tabs.json'
const MAX_RECENT_REPOS = 10

class ConfigService {
  private getConfigPath(filename: string): string {
    return path.join(app.getPath('userData'), filename)
  }

  private readJson<T>(filename: string, defaultValue: T): T {
    try {
      const filePath = this.getConfigPath(filename)
      if (!fs.existsSync(filePath)) return defaultValue
      const data = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(data) as T
    } catch {
      return defaultValue
    }
  }

  private writeJson<T>(filename: string, data: T): void {
    try {
      const filePath = this.getConfigPath(filename)
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error(`Failed to write config ${filename}:`, error)
    }
  }

  getRecentRepos(): string[] {
    return this.readJson<string[]>(RECENT_REPOS_FILE, [])
  }

  addRecentRepo(repoPath: string): void {
    const repos = this.getRecentRepos()
    // Remove if already exists to move to top
    const filtered = repos.filter((r) => r !== repoPath)
    filtered.unshift(repoPath)
    // Keep only MAX_RECENT_REPOS
    if (filtered.length > MAX_RECENT_REPOS) {
      filtered.splice(MAX_RECENT_REPOS)
    }
    this.writeJson(RECENT_REPOS_FILE, filtered)
  }

  removeRecentRepo(repoPath: string): void {
    const repos = this.getRecentRepos()
    const filtered = repos.filter((r) => r !== repoPath)
    this.writeJson(RECENT_REPOS_FILE, filtered)
  }

  getSessionTabs(): string[] {
    return this.readJson<string[]>(SESSION_TABS_FILE, [])
  }

  saveSessionTabs(tabPaths: string[]): void {
    this.writeJson(SESSION_TABS_FILE, tabPaths)
  }
}

export const configService = new ConfigService()
