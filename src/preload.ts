import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  platform: string
  openDirectory: () => Promise<string | null>
  config: {
    getRecentRepos: () => Promise<string[]>
    addRecentRepo: (repoPath: string) => Promise<void>
    removeRecentRepo: (repoPath: string) => Promise<void>
    getSessionTabs: () => Promise<string[]>
    saveSessionTabs: (tabPaths: string[]) => Promise<void>
  }
  git: {
    openRepo: (repoPath: string) => Promise<any>
    closeRepo: (repoPath: string) => Promise<any>
    getStatus: (repoPath: string) => Promise<any>
    getBranches: (repoPath: string) => Promise<any>
    getLog: (repoPath: string, maxCount?: number) => Promise<any>
    getDiff: (repoPath: string, commitHash?: string, filePath?: string) => Promise<any>
    getWorkingDiff: (repoPath: string, filePath?: string) => Promise<any>
    getStagedDiff: (repoPath: string, filePath?: string) => Promise<any>
    getCommitDiff: (repoPath: string, commitHash: string) => Promise<any>
    stage: (repoPath: string, filePaths: string[]) => Promise<any>
    unstage: (repoPath: string, filePaths: string[]) => Promise<any>
    commit: (repoPath: string, message: string) => Promise<any>
    checkout: (repoPath: string, target: string, createBranch?: boolean) => Promise<any>
    createBranch: (repoPath: string, branchName: string, from?: string) => Promise<any>
    push: (repoPath: string, remote?: string, branch?: string) => Promise<any>
    pull: (repoPath: string, remote?: string, branch?: string) => Promise<any>
    fetch: (repoPath: string, remote?: string) => Promise<any>
    merge: (repoPath: string, branchName: string) => Promise<any>
    rebase: (repoPath: string, branchName: string) => Promise<any>
    deleteBranch: (repoPath: string, branchName: string, force?: boolean) => Promise<any>
    renameBranch: (repoPath: string, oldName: string, newName: string) => Promise<any>
  }
}

const api: ElectronAPI = {
  platform: process.platform,
  openDirectory: async () => {
    return await ipcRenderer.invoke('dialog:openDirectory')
  },
  config: {
    getRecentRepos: () => ipcRenderer.invoke('config:getRecentRepos'),
    addRecentRepo: (repoPath: string) => ipcRenderer.invoke('config:addRecentRepo', repoPath),
    removeRecentRepo: (repoPath: string) => ipcRenderer.invoke('config:removeRecentRepo', repoPath),
    getSessionTabs: () => ipcRenderer.invoke('config:getSessionTabs'),
    saveSessionTabs: (tabPaths: string[]) => ipcRenderer.invoke('config:saveSessionTabs', tabPaths)
  },
  git: {
    openRepo: (repoPath: string) => ipcRenderer.invoke('git:openRepo', repoPath),
    closeRepo: (repoPath: string) => ipcRenderer.invoke('git:closeRepo', repoPath),
    getStatus: (repoPath: string) => ipcRenderer.invoke('git:getStatus', repoPath),
    getBranches: (repoPath: string) => ipcRenderer.invoke('git:getBranches', repoPath),
    getLog: (repoPath: string, maxCount?: number) => ipcRenderer.invoke('git:getLog', repoPath, maxCount),
    getDiff: (repoPath: string, commitHash?: string, filePath?: string) => ipcRenderer.invoke('git:getDiff', repoPath, commitHash, filePath),
    getWorkingDiff: (repoPath: string, filePath?: string) => ipcRenderer.invoke('git:getWorkingDiff', repoPath, filePath),
    getStagedDiff: (repoPath: string, filePath?: string) => ipcRenderer.invoke('git:getStagedDiff', repoPath, filePath),
    getCommitDiff: (repoPath: string, commitHash: string) => ipcRenderer.invoke('git:getCommitDiff', repoPath, commitHash),
    stage: (repoPath: string, filePaths: string[]) => ipcRenderer.invoke('git:stage', repoPath, filePaths),
    unstage: (repoPath: string, filePaths: string[]) => ipcRenderer.invoke('git:unstage', repoPath, filePaths),
    commit: (repoPath: string, message: string) => ipcRenderer.invoke('git:commit', repoPath, message),
    checkout: (repoPath: string, target: string, createBranch?: boolean) => ipcRenderer.invoke('git:checkout', repoPath, target, createBranch),
    createBranch: (repoPath: string, branchName: string, from?: string) => ipcRenderer.invoke('git:createBranch', repoPath, branchName, from),
    push: (repoPath: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:push', repoPath, remote, branch),
    pull: (repoPath: string, remote?: string, branch?: string) => ipcRenderer.invoke('git:pull', repoPath, remote, branch),
    fetch: (repoPath: string, remote?: string) => ipcRenderer.invoke('git:fetch', repoPath, remote),
    merge: (repoPath: string, branchName: string) => ipcRenderer.invoke('git:merge', repoPath, branchName),
    rebase: (repoPath: string, branchName: string) => ipcRenderer.invoke('git:rebase', repoPath, branchName),
    deleteBranch: (repoPath: string, branchName: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', repoPath, branchName, force),
    renameBranch: (repoPath: string, oldName: string, newName: string) => ipcRenderer.invoke('git:renameBranch', repoPath, oldName, newName)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (for testing in non-isolated context)
  window.electronAPI = api
}
