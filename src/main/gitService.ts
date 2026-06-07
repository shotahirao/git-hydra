import simpleGit, { SimpleGit } from 'simple-git'
import { CommitInfo, BranchInfo, FileStatus, GitStatus, DiffFile, DiffHunk, DiffLine, RepoInfo } from '@git-types/git'
import fs from 'node:fs'
import path from 'node:path'

class GitService {
  private git: SimpleGit | null = null
  private repoPath: string = ''

  async openRepo(path: string): Promise<RepoInfo> {
    try {
      const git = simpleGit(path)
      await git.status()
      this.git = git
      this.repoPath = path
      const status = await git.status()
      return {
        path,
        valid: true,
        currentBranch: status.current ? status.current : undefined,
        ahead: status.ahead,
        behind: status.behind
      }
    } catch (error) {
      return { path, valid: false }
    }
  }

  isRepoOpen(): boolean {
    return this.git !== null
  }

  async getStatus(): Promise<GitStatus> {
    if (!this.git) throw new Error('No repository open')
    const status = await this.git.status()
    
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

  async getBranches(): Promise<BranchInfo[]> {
    if (!this.git) throw new Error('No repository open')
    const summary = await this.git.branch(['-a'])
    return Object.values(summary.branches).map((branch) => ({
      name: branch.name,
      current: branch.current,
      remote: branch.label || undefined,
      label: branch.name.replace('remotes/', '')
    }))
  }

  async getLog(maxCount: number = 200): Promise<CommitInfo[]> {
    if (!this.git) throw new Error('No repository open')
    
    const log = await this.git.log({
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

  async getDiff(commitHash?: string, filePath?: string): Promise<DiffFile[]> {
    if (!this.git) throw new Error('No repository open')
    
    let diffText: string
    if (commitHash) {
      diffText = await this.git.show([commitHash, '--format=', '-p'])
    } else {
      diffText = await this.git.diff(['--no-color', filePath || '.'])
    }
    
    return this.parseDiff(diffText)
  }

  async getWorkingDiff(filePath?: string): Promise<DiffFile[]> {
    if (!this.git) throw new Error('No repository open')
    const diffText = await this.git.diff(['--no-color', filePath || '.'])
    return this.parseDiff(diffText)
  }

  async getStagedDiff(filePath?: string): Promise<DiffFile[]> {
    if (!this.git) throw new Error('No repository open')
    const diffText = await this.git.diff(['--cached', '--no-color', filePath || '.'])
    return this.parseDiff(diffText)
  }

  async getCommitDiff(commitHash: string): Promise<DiffFile[]> {
    if (!this.git) throw new Error('No repository open')
    const diffText = await this.git.show([commitHash, '--format=', '-p'])
    return this.parseDiff(diffText)
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
          const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
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

  async stage(filePaths: string[]): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.git.add(filePaths)
  }

  async unstage(filePaths: string[]): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.git.reset(['HEAD', '--', ...filePaths])
  }

  async commit(message: string): Promise<string> {
    if (!this.git) throw new Error('No repository open')
    const result = await this.git.commit(message)
    return result.commit || ''
  }

  private async ensureNoLock(): Promise<void> {
    if (!this.repoPath) return
    const lockFile = path.join(this.repoPath, '.git', 'index.lock')
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile)
      } catch (e) {
        // If we can't remove it, throw a clear error
        throw new Error('Git repository is locked by another process. Please close other Git applications and try again.')
      }
    }
  }

  async checkout(target: string, createBranch: boolean = false): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    if (createBranch) {
      await this.git.checkoutLocalBranch(target)
    } else {
      await this.git.checkout(target)
    }
  }

  async createBranch(branchName: string, from?: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    await this.git.checkoutBranch(branchName, from || 'HEAD')
  }

  async push(remote?: string, branch?: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    await this.git.push(remote || 'origin', branch || 'HEAD')
  }

  async pull(remote?: string, branch?: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    await this.git.pull(remote || 'origin', branch || 'HEAD')
  }

  async fetch(remote?: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    await this.git.fetch(remote || 'origin')
  }

  async merge(branchName: string): Promise<string> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    try {
      const result = await this.git.merge([branchName])
      return `Merged ${branchName}: ${result}`
    } catch (error: any) {
      if (error.message && error.message.includes('CONFLICT')) {
        throw new Error(`Merge conflict occurred when merging ${branchName}. Please resolve conflicts manually.`)
      }
      throw error
    }
  }

  async rebase(branchName: string): Promise<string> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    try {
      await this.git.rebase([branchName])
      return `Rebased onto ${branchName}`
    } catch (error: any) {
      throw new Error(`Rebase failed: ${error.message}`)
    }
  }

  async deleteBranch(branchName: string, force: boolean = false): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    const options = force ? ['-D', branchName] : ['-d', branchName]
    await this.git.branch(options)
  }

  async renameBranch(oldName: string, newName: string): Promise<void> {
    if (!this.git) throw new Error('No repository open')
    await this.ensureNoLock()
    await this.git.branch(['-m', oldName, newName])
  }
}

export const gitService = new GitService()
