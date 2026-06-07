import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  openDirectory: () => Promise<string | null>
  git: {
    openRepo: (path: string) => Promise<any>
    getStatus: () => Promise<any>
    getBranches: () => Promise<any>
    getLog: (maxCount?: number) => Promise<any>
    getDiff: (commitHash?: string, filePath?: string) => Promise<any>
    getWorkingDiff: (filePath?: string) => Promise<any>
    getStagedDiff: (filePath?: string) => Promise<any>
    getCommitDiff: (commitHash: string) => Promise<any>
    stage: (filePaths: string[]) => Promise<any>
    unstage: (filePaths: string[]) => Promise<any>
    commit: (message: string) => Promise<any>
    checkout: (target: string, createBranch?: boolean) => Promise<any>
    createBranch: (branchName: string, from?: string) => Promise<any>
    push: (remote?: string, branch?: string) => Promise<any>
    pull: (remote?: string, branch?: string) => Promise<any>
    fetch: (remote?: string) => Promise<any>
    merge: (branchName: string) => Promise<any>
    rebase: (branchName: string) => Promise<any>
    deleteBranch: (branchName: string, force?: boolean) => Promise<any>
    renameBranch: (oldName: string, newName: string) => Promise<any>
  }
}

const api: ElectronAPI = {
  openDirectory: async () => {
    return await ipcRenderer.invoke('dialog:openDirectory')
  },
  git: {
    openRepo: (path: string) => ipcRenderer.invoke('git:openRepo', path),
    getStatus: () => ipcRenderer.invoke('git:getStatus'),
    getBranches: () => ipcRenderer.invoke('git:getBranches'),
    getLog: (maxCount?: number) => ipcRenderer.invoke('git:getLog', maxCount),
    getDiff: (commitHash?: string, filePath?: string) => ipcRenderer.invoke('git:getDiff', commitHash, filePath),
    getWorkingDiff: (filePath?: string) => ipcRenderer.invoke('git:getWorkingDiff', filePath),
    getStagedDiff: (filePath?: string) => ipcRenderer.invoke('git:getStagedDiff', filePath),
    getCommitDiff: (commitHash: string) => ipcRenderer.invoke('git:getCommitDiff', commitHash),
    stage: (filePaths: string[]) => ipcRenderer.invoke('git:stage', filePaths),
    unstage: (filePaths: string[]) => ipcRenderer.invoke('git:unstage', filePaths),
    commit: (message: string) => ipcRenderer.invoke('git:commit', message),
    checkout: (target: string, createBranch?: boolean) => ipcRenderer.invoke('git:checkout', target, createBranch),
    createBranch: (branchName: string, from?: string) => ipcRenderer.invoke('git:createBranch', branchName, from),
    push: (remote?: string, branch?: string) => ipcRenderer.invoke('git:push', remote, branch),
    pull: (remote?: string, branch?: string) => ipcRenderer.invoke('git:pull', remote, branch),
    fetch: (remote?: string) => ipcRenderer.invoke('git:fetch', remote),
    merge: (branchName: string) => ipcRenderer.invoke('git:merge', branchName),
    rebase: (branchName: string) => ipcRenderer.invoke('git:rebase', branchName),
    deleteBranch: (branchName: string, force?: boolean) => ipcRenderer.invoke('git:deleteBranch', branchName, force),
    renameBranch: (oldName: string, newName: string) => ipcRenderer.invoke('git:renameBranch', oldName, newName)
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
