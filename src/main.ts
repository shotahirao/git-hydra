import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { gitService } from './main/gitService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173'
const RENDERER_DIST = path.join(__dirname, '../renderer')

// Disable GPU to prevent crashes on macOS
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let win: BrowserWindow | null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  win.on('ready-to-show', () => {
    win?.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['VITE_DEV_SERVER_URL']) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('git:openRepo', async (_, path: string) => {
  return await gitService.openRepo(path)
})

ipcMain.handle('git:getStatus', async () => {
  return await gitService.getStatus()
})

ipcMain.handle('git:getBranches', async () => {
  return await gitService.getBranches()
})

ipcMain.handle('git:getLog', async (_, maxCount?: number) => {
  return await gitService.getLog(maxCount)
})

ipcMain.handle('git:getDiff', async (_, commitHash?: string, filePath?: string) => {
  return await gitService.getDiff(commitHash, filePath)
})

ipcMain.handle('git:getWorkingDiff', async (_, filePath?: string) => {
  return await gitService.getWorkingDiff(filePath)
})

ipcMain.handle('git:getStagedDiff', async (_, filePath?: string) => {
  return await gitService.getStagedDiff(filePath)
})

ipcMain.handle('git:getCommitDiff', async (_, commitHash: string) => {
  return await gitService.getCommitDiff(commitHash)
})

ipcMain.handle('git:stage', async (_, filePaths: string[]) => {
  return await gitService.stage(filePaths)
})

ipcMain.handle('git:unstage', async (_, filePaths: string[]) => {
  return await gitService.unstage(filePaths)
})

ipcMain.handle('git:commit', async (_, message: string) => {
  return await gitService.commit(message)
})

ipcMain.handle('git:checkout', async (_, target: string, createBranch?: boolean) => {
  return await gitService.checkout(target, createBranch)
})

ipcMain.handle('git:createBranch', async (_, branchName: string, from?: string) => {
  return await gitService.createBranch(branchName, from)
})

ipcMain.handle('git:push', async (_, remote?: string, branch?: string) => {
  return await gitService.push(remote, branch)
})

ipcMain.handle('git:pull', async (_, remote?: string, branch?: string) => {
  return await gitService.pull(remote, branch)
})

ipcMain.handle('git:fetch', async (_, remote?: string) => {
  return await gitService.fetch(remote)
})

ipcMain.handle('git:merge', async (_, branchName: string) => {
  return await gitService.merge(branchName)
})

ipcMain.handle('git:rebase', async (_, branchName: string) => {
  return await gitService.rebase(branchName)
})

ipcMain.handle('git:deleteBranch', async (_, branchName: string, force?: boolean) => {
  return await gitService.deleteBranch(branchName, force)
})

ipcMain.handle('git:renameBranch', async (_, oldName: string, newName: string) => {
  return await gitService.renameBranch(oldName, newName)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
