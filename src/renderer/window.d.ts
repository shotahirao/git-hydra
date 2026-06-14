import type { WorktreeInfo } from './api/tauri'
import type {
  BranchInfo,
  CommitInfo,
  DiffFile,
  GitStatus,
  RepoInfo
} from '@git-types/git'

export interface TauriAPI {
  platform: string
  openDirectory: () => Promise<string | null>
  openExternal: (url: string) => Promise<void>
  onRepoChanged: (callback: (repoPath: string) => void) => () => void
  config: {
    getRecentRepos: () => Promise<string[]>
    addRecentRepo: (repoPath: string) => Promise<void>
    removeRecentRepo: (repoPath: string) => Promise<void>
    getSessionTabs: () => Promise<string[]>
    saveSessionTabs: (tabPaths: string[]) => Promise<void>
  }
  git: {
    isValidRepo: (repoPath: string) => Promise<boolean>
    openRepo: (repoPath: string) => Promise<RepoInfo>
    closeRepo: (repoPath: string) => Promise<void>
    watchRepo: (repoPath: string) => Promise<void>
    unwatchRepo: (repoPath: string) => Promise<void>
    getStatus: (repoPath: string) => Promise<GitStatus>
    getBranches: (repoPath: string) => Promise<BranchInfo[]>
    getLog: (
      repoPath: string,
      maxCount?: number,
      skip?: number
    ) => Promise<CommitInfo[]>
    getDiff: (
      repoPath: string,
      commitHash?: string,
      filePath?: string
    ) => Promise<DiffFile[]>
    getWorkingDiff: (repoPath: string, filePath?: string) => Promise<DiffFile[]>
    getStagedDiff: (repoPath: string, filePath?: string) => Promise<DiffFile[]>
    getCommitDiff: (
      repoPath: string,
      commitHash: string
    ) => Promise<DiffFile[]>
    stage: (repoPath: string, filePaths: string[]) => Promise<void>
    unstage: (repoPath: string, filePaths: string[]) => Promise<void>
    commit: (repoPath: string, message: string) => Promise<string>
    checkout: (
      repoPath: string,
      target: string,
      createBranch?: boolean
    ) => Promise<void>
    createBranch: (
      repoPath: string,
      branchName: string,
      from?: string
    ) => Promise<void>
    push: (repoPath: string, remote?: string, branch?: string) => Promise<void>
    pull: (
      repoPath: string,
      remote?: string,
      branch?: string
    ) => Promise<string>
    fetch: (repoPath: string, remote?: string) => Promise<void>
    merge: (repoPath: string, branchName: string) => Promise<string>
    rebase: (repoPath: string, branchName: string) => Promise<string>
    deleteBranch: (
      repoPath: string,
      branchName: string,
      force?: boolean
    ) => Promise<void>
    renameBranch: (
      repoPath: string,
      oldName: string,
      newName: string
    ) => Promise<void>
    listWorktrees: (repoPath: string) => Promise<WorktreeInfo[]>
    addWorktree: (
      repoPath: string,
      name: string,
      path: string,
      reference?: string
    ) => Promise<WorktreeInfo>
    removeWorktree: (repoPath: string, name: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: TauriAPI
    __sessionTabs?: string[]
  }
}

export {}
