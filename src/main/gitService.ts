import simpleGit, { SimpleGit } from 'simple-git'
import { CommitInfo, BranchInfo, FileStatus, GitStatus, DiffFile, DiffHunk, DiffLine, RepoInfo } from '@git-types/git'
import fs from 'node:fs'
import path from 'node:path'

class GitService {
  private repos: Map<string, SimpleGit> = new Map()

  private getGit(repoPath: string): SimpleGit {
    const git = this.repos.get(repoPath)
    if (!git) throw new Error(`Repository not open: ${repoPath}`)
    return git
  }

  async openRepo(repoPath: string): Promise<RepoInfo> {
    try {
      const git = simpleGit(repoPath)
      const status = await git.status()
      this.repos.set(repoPath, git)
      return {
        path: repoPath,
        valid: true,
        currentBranch: status.current ? status.current : undefined,
        ahead: status.ahead,
        behind: status.behind
      }
    } catch (error) {
      return { path: repoPath, valid: false }
    }
  }

  isRepoOpen(repoPath: string): boolean {
    return this.repos.has(repoPath)
  }

  closeRepo(repoPath: string): void {
    this.repos.delete(repoPath)
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    const git = this.getGit(repoPath)
    const status = await git.status()
    
    const staged: FileStatus[] = []
    const modified: FileStatus[] = []
    const untracked: FileStatus[] = []
    const conflicted: FileStatus[] = []

    status.files.forEach((file) => {
      const f: FileStatus = {
        path: file.path,
        index: file.index,
        working_dir: file.working_dir,
        status: this.determineStatus(file.index, file.working_dir)
      }
      if (file.index === 'C' || (file.index !== '?' && file.index !== ' ')) {
        staged.push(f)
      }
      if (file.working_dir === 'C' || (file.working_dir !== '?' && file.working_dir !== ' ')) {
        if (file.index !== ' ') modified.push(f)
      }
      if (file.working_dir === '?' || file.index === '?') {
        untracked.push(f)
      }
      if (file.index === 'C' || file.working_dir === 'C' || file.index === 'U' || file.working_dir === 'U') {
        conflicted.push(f)
      }
    })

    return {
      current: status.current || '',
      tracking: status.tracking ? status.tracking : undefined,
      ahead: status.ahead || 0,
      behind: status.behind || 0,
      staged,
      modified,
      untracked,
      conflicted
    }
  }

  private determineStatus(index: string, working_dir: string): FileStatus['status'] {
    const code = index !== ' ' ? index : working_dir
    switch (code) {
      case 'M': return 'modified'
      case 'A': return 'added'
      case 'D': return 'deleted'
      case 'R': return 'renamed'
      case 'C': return 'copied'
      case '?': return 'untracked'
      case '!': return 'ignored'
      case 'U': return 'conflicted'
      default: return 'modified'
    }
  }

  async getBranches(repoPath: string): Promise<BranchInfo[]> {
    const git = this.getGit(repoPath)
    const summary = await git.branch(['-a'])
    return Object.values(summary.branches).map((branch) => ({
      name: branch.name,
      current: branch.current,
      remote: branch.label || undefined,
      label: branch.name.replace('remotes/', '')
    }))
  }

  async getLog(repoPath: string, maxCount: number = 200): Promise<CommitInfo[]> {
    const git = this.getGit(repoPath)
    
    const log = await git.log({
      maxCount,
      '--all': null,
      format: {
        hash: '%H',
        message: '%s',
        author_name: '%an',
        author_email: '%ae',
        date: '%ai',
        parents: '%P',
        refs: '%D'
      }
    })

    return log.all.map((commit: any) => ({
      hash: commit.hash,
      message: commit.message,
      author_name: commit.author_name,
      author_email: commit.author_email,
      date: commit.date,
      parents: commit.parents ? commit.parents.split(' ').filter((p: string) => p) : [],
      refs: commit.refs || '',
      isMerge: commit.parents ? commit.parents.split(' ').filter((p: string) => p).length > 1 : false
    }))
  }

  async getDiff(repoPath: string, commitHash?: string, filePath?: string): Promise<DiffFile[]> {
    const git = this.getGit(repoPath)
    
    let diffText: string
    if (commitHash) {
      diffText = await git.show([commitHash, '--format=', '-p'])
    } else {
      diffText = await git.diff(['--no-color', filePath || '.'])
    }
    
    return this.parseDiff(diffText)
  }

  async getWorkingDiff(repoPath: string, filePath?: string): Promise<DiffFile[]> {
    const git = this.getGit(repoPath)
    const diffText = await git.diff(['--no-color', filePath || '.'])
    return this.parseDiff(diffText)
  }

  async getStagedDiff(repoPath: string, filePath?: string): Promise<DiffFile[]> {
    const git = this.getGit(repoPath)
    const diffText = await git.diff(['--cached', '--no-color', filePath || '.'])
    return this.parseDiff(diffText)
  }

  async getCommitDiff(repoPath: string, commitHash: string): Promise<DiffFile[]> {
    const git = this.getGit(repoPath)
    const diffText = await git.show([commitHash, '--format=', '-p'])
    console.log('[gitService] getCommitDiff raw output length:', diffText.length, 'first 200 chars:', diffText.substring(0, 200))
    const result = this.parseDiff(diffText)
    console.log('[gitService] getCommitDiff parsed files:', result.length)
    return result
  }

  private parseDiff(diffText: string): DiffFile[] {
    const files: DiffFile[] = []
    const lines = diffText.split('\n')
    let currentFile: DiffFile | null = null
    let currentHunk: DiffHunk | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          if (currentHunk) currentFile.hunks.push(currentHunk)
          files.push(currentFile)
        }
        const match = line.match(/diff --git a\/(.+) b\/(.+)/)
        currentFile = {
          path: match ? match[2] : '',
          status: 'modified',
          hunks: []
        }
        currentHunk = null
      } else if (line.startsWith('new file mode')) {
        if (currentFile) currentFile.status = 'added'
      } else if (line.startsWith('deleted file mode')) {
        if (currentFile) currentFile.status = 'deleted'
      } else if (line.startsWith('rename from')) {
        if (currentFile) {
          currentFile.status = 'renamed'
          currentFile.oldPath = line.replace('rename from ', '')
        }
      } else if (line.startsWith('@@')) {
        if (currentFile) {
          if (currentHunk) currentFile.hunks.push(currentHunk)
          const match = line.match(/@@ -(\d+)(?:(\d+))? \+(\d+)(?:(\d+))? @@/)
          if (match) {
            currentHunk = {
              oldStart: parseInt(match[1]),
              oldLines: parseInt(match[2] || '1'),
              newStart: parseInt(match[3]),
              newLines: parseInt(match[4] || '1'),
              lines: [{
                type: 'header',
                content: line
              }]
            }
          }
        }
      } else if (currentHunk) {
        let type: DiffLine['type'] = 'normal'
        if (line.startsWith('+')) type = 'add'
        else if (line.startsWith('-')) type = 'del'
        
        currentHunk.lines.push({
          type,
          content: line
        })
      }
    }

    if (currentFile) {
      if (currentHunk) currentFile.hunks.push(currentHunk)
      files.push(currentFile)
    }

    return files
  }

  async stage(repoPath: string, filePaths: string[]): Promise<void> {
    const git = this.getGit(repoPath)
    await git.add(filePaths)
  }

  async unstage(repoPath: string, filePaths: string[]): Promise<void> {
    const git = this.getGit(repoPath)
    await git.reset(['HEAD', '--', ...filePaths])
  }

  async commit(repoPath: string, message: string): Promise<string> {
    const git = this.getGit(repoPath)
    const result = await git.commit(message)
    return result.commit || ''
  }

  private async ensureNoLock(repoPath: string): Promise<void> {
    const lockFile = path.join(repoPath, '.git', 'index.lock')
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile)
      } catch (e) {
        throw new Error('Git repository is locked by another process. Please close other Git applications and try again.')
      }
    }
  }

  async checkout(repoPath: string, target: string, createBranch: boolean = false): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    if (createBranch) {
      await git.checkoutLocalBranch(target)
    } else {
      await git.checkout(target)
    }
  }

  async createBranch(repoPath: string, branchName: string, from?: string): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    await git.checkoutBranch(branchName, from || 'HEAD')
  }

  async push(repoPath: string, remote?: string, branch?: string): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    await git.push(remote || 'origin', branch || 'HEAD')
  }

  async pull(repoPath: string, remote?: string, branch?: string): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    await git.pull(remote || 'origin', branch || 'HEAD')
  }

  async fetch(repoPath: string, remote?: string): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    await git.fetch(remote || 'origin')
  }

  async merge(repoPath: string, branchName: string): Promise<string> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    try {
      const result = await git.merge([branchName])
      return `Merged ${branchName}: ${result}`
    } catch (error: any) {
      if (error.message && error.message.includes('CONFLICT')) {
        throw new Error(`Merge conflict occurred when merging ${branchName}. Please resolve conflicts manually.`)
      }
      throw error
    }
  }

  async rebase(repoPath: string, branchName: string): Promise<string> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    try {
      await git.rebase([branchName])
      return `Rebased onto ${branchName}`
    } catch (error: any) {
      throw new Error(`Rebase failed: ${error.message}`)
    }
  }

  async deleteBranch(repoPath: string, branchName: string, force: boolean = false): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    const options = force ? ['-D', branchName] : ['-d', branchName]
    await git.branch(options)
  }

  async renameBranch(repoPath: string, oldName: string, newName: string): Promise<void> {
    const git = this.getGit(repoPath)
    await this.ensureNoLock(repoPath)
    await git.branch(['-m', oldName, newName])
  }
}

export const gitService = new GitService()
