import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import type {
  BranchInfo,
  CommitInfo,
  DiffFile,
  GitStatus,
  RepoInfo
} from '@git-types/git'

export interface WorktreeInfo {
  name: string
  path: string
}

export const platform = (): string => {
  const p = navigator.platform.toLowerCase()
  if (p.startsWith('mac')) return 'darwin'
  if (p.startsWith('win')) return 'win32'
  if (p.startsWith('linux')) return 'linux'
  return p
}

export const openDirectory = async (): Promise<string | null> => {
  const selected = await open({
    directory: true,
    multiple: false
  })
  if (selected === null) return null
  return Array.isArray(selected) ? selected[0] ?? null : selected
}

export const openExternal = async (url: string): Promise<void> => {
  await openUrl(url)
}

export const onRepoChanged = (
  callback: (repoPath: string) => void
): (() => void) => {
  let unlisten: UnlistenFn | undefined
  const setup = async (): Promise<void> => {
    unlisten = await listen<string>('git:repoChanged', (event) => {
      callback(event.payload)
    })
  }
  setup().catch(console.error)
  return () => {
    unlisten?.()
  }
}

export const config = {
  getRecentRepos: async (): Promise<string[]> => {
    return await invoke<string[]>('get_recent_repos')
  },
  addRecentRepo: async (repoPath: string): Promise<void> => {
    await invoke('add_recent_repo', { repoPath })
  },
  removeRecentRepo: async (repoPath: string): Promise<void> => {
    await invoke('remove_recent_repo', { repoPath })
  },
  getSessionTabs: async (): Promise<string[]> => {
    return await invoke<string[]>('get_session_tabs')
  },
  saveSessionTabs: async (tabPaths: string[]): Promise<void> => {
    await invoke('save_session_tabs', { tabPaths })
  }
}

export const git = {
  isValidRepo: async (repoPath: string): Promise<boolean> => {
    return await invoke<boolean>('git_is_valid_repo', { repoPath })
  },
  openRepo: async (repoPath: string): Promise<RepoInfo> => {
    return await invoke<RepoInfo>('git_open_repo', { repoPath })
  },
  closeRepo: async (repoPath: string): Promise<void> => {
    await invoke('git_close_repo', { repoPath })
  },
  watchRepo: async (repoPath: string): Promise<void> => {
    await invoke('git_watch_repo', { repoPath })
  },
  unwatchRepo: async (repoPath: string): Promise<void> => {
    await invoke('git_unwatch_repo', { repoPath })
  },
  getStatus: async (repoPath: string): Promise<GitStatus> => {
    return await invoke<GitStatus>('git_get_status', { repoPath })
  },
  getBranches: async (repoPath: string): Promise<BranchInfo[]> => {
    return await invoke<BranchInfo[]>('git_get_branches', { repoPath })
  },
  getLog: async (
    repoPath: string,
    maxCount = 200,
    skip = 0
  ): Promise<CommitInfo[]> => {
    return await invoke<CommitInfo[]>('git_get_log', { repoPath, maxCount, skip })
  },
  getDiff: async (
    repoPath: string,
    commitHash?: string,
    filePath?: string
  ): Promise<DiffFile[]> => {
    return await invoke<DiffFile[]>('git_get_diff', {
      repoPath,
      commitHash,
      filePath
    })
  },
  getWorkingDiff: async (
    repoPath: string,
    filePath?: string
  ): Promise<DiffFile[]> => {
    return await invoke<DiffFile[]>('git_get_working_diff', { repoPath, filePath })
  },
  getStagedDiff: async (
    repoPath: string,
    filePath?: string
  ): Promise<DiffFile[]> => {
    return await invoke<DiffFile[]>('git_get_staged_diff', { repoPath, filePath })
  },
  getCommitDiff: async (
    repoPath: string,
    commitHash: string
  ): Promise<DiffFile[]> => {
    return await invoke<DiffFile[]>('git_get_commit_diff', { repoPath, commitHash })
  },
  stage: async (repoPath: string, filePaths: string[]): Promise<void> => {
    await invoke('git_stage', { repoPath, filePaths })
  },
  unstage: async (repoPath: string, filePaths: string[]): Promise<void> => {
    await invoke('git_unstage', { repoPath, filePaths })
  },
  commit: async (repoPath: string, message: string): Promise<string> => {
    return await invoke<string>('git_commit', { repoPath, message })
  },
  checkout: async (
    repoPath: string,
    target: string,
    createBranch?: boolean
  ): Promise<void> => {
    await invoke('git_checkout', { repoPath, target, createBranch })
  },
  createBranch: async (
    repoPath: string,
    branchName: string,
    from?: string
  ): Promise<void> => {
    await invoke('git_create_branch', { repoPath, branchName, from })
  },
  push: async (
    repoPath: string,
    remote?: string,
    branch?: string
  ): Promise<void> => {
    await invoke('git_push', { repoPath, remote, branch })
  },
  pull: async (
    repoPath: string,
    remote?: string,
    branch?: string
  ): Promise<string> => {
    return await invoke<string>('git_pull', { repoPath, remote, branch })
  },
  fetch: async (repoPath: string, remote?: string): Promise<void> => {
    await invoke('git_fetch', { repoPath, remote })
  },
  merge: async (repoPath: string, branchName: string): Promise<string> => {
    return await invoke<string>('git_merge', { repoPath, branchName })
  },
  rebase: async (repoPath: string, branchName: string): Promise<string> => {
    return await invoke<string>('git_rebase', { repoPath, branchName })
  },
  deleteBranch: async (
    repoPath: string,
    branchName: string,
    force?: boolean
  ): Promise<void> => {
    await invoke('git_delete_branch', { repoPath, branchName, force })
  },
  renameBranch: async (
    repoPath: string,
    oldName: string,
    newName: string
  ): Promise<void> => {
    await invoke('git_rename_branch', { repoPath, oldName, newName })
  },
  listWorktrees: async (repoPath: string): Promise<WorktreeInfo[]> => {
    return await invoke<WorktreeInfo[]>('git_list_worktrees', { repoPath })
  },
  addWorktree: async (
    repoPath: string,
    name: string,
    path: string,
    reference?: string
  ): Promise<WorktreeInfo> => {
    return await invoke<WorktreeInfo>('git_add_worktree', {
      repoPath,
      name,
      path,
      reference
    })
  },
  removeWorktree: async (repoPath: string, name: string): Promise<void> => {
    await invoke('git_remove_worktree', { repoPath, name })
  }
}
