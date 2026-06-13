import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { gitService } from './main/gitService'
import { configService } from './main/configService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] || 'http://localhost:5173'
const RENDERER_DIST = path.join(__dirname, '../renderer')

// Disable GPU to prevent crashes on macOS
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let win: BrowserWindow | null

function getResourcePath(relativePath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath)
  }

  // In dev/preview, prefer the built output path when available;
  // otherwise fall back to the project root (e.g. preview run directly).
  const outPath = path.join(__dirname, '../', relativePath)
  if (fs.existsSync(outPath)) {
    return outPath
  }
  return path.join(process.cwd(), relativePath)
}

function createWindow(): void {
  const iconPath = getResourcePath('resources/icon.png')
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
    show: true,
    icon: iconPath
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['VITE_DEV_SERVER_URL']) {
    console.log('Loading dev server URL:', VITE_DEV_SERVER_URL)
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    const htmlPath = path.join(RENDERER_DIST, 'index.html')
    console.log('Loading file:', htmlPath)
    win.loadFile(htmlPath)
  }
}

// IPC Handlers
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// Config IPC Handlers
ipcMain.handle('config:getRecentRepos', async () => {
  return configService.getRecentRepos()
})

ipcMain.handle('config:addRecentRepo', async (_, repoPath: string) => {
  configService.addRecentRepo(repoPath)
})

ipcMain.handle('config:removeRecentRepo', async (_, repoPath: string) => {
  configService.removeRecentRepo(repoPath)
})

ipcMain.handle('config:getSessionTabs', async () => {
  return configService.getSessionTabs()
})

ipcMain.handle('config:saveSessionTabs', async (_, tabPaths: string[]) => {
  configService.saveSessionTabs(tabPaths)
})

// Git IPC Handlers
ipcMain.handle('git:openRepo', async (_, repoPath: string) => {
  return await gitService.openRepo(repoPath)
})

ipcMain.handle('git:closeRepo', async (_, repoPath: string) => {
  gitService.closeRepo(repoPath)
})

ipcMain.handle('git:getStatus', async (_, repoPath: string) => {
  return await gitService.getStatus(repoPath)
})

ipcMain.handle('git:getBranches', async (_, repoPath: string) => {
  return await gitService.getBranches(repoPath)
})

ipcMain.handle('git:getLog', async (_, repoPath: string, maxCount?: number) => {
  return await gitService.getLog(repoPath, maxCount)
})

ipcMain.handle('git:getDiff', async (_, repoPath: string, commitHash?: string, filePath?: string) => {
  return await gitService.getDiff(repoPath, commitHash, filePath)
})

ipcMain.handle('git:getWorkingDiff', async (_, repoPath: string, filePath?: string) => {
  return await gitService.getWorkingDiff(repoPath, filePath)
})

ipcMain.handle('git:getStagedDiff', async (_, repoPath: string, filePath?: string) => {
  return await gitService.getStagedDiff(repoPath, filePath)
})

ipcMain.handle('git:getCommitDiff', async (_, repoPath: string, commitHash: string) => {
  console.log('[IPC] getCommitDiff called for:', repoPath, commitHash)
  const result = await gitService.getCommitDiff(repoPath, commitHash)
  console.log('[IPC] getCommitDiff result:', result.length, 'files')
  return result
})

ipcMain.handle('git:stage', async (_, repoPath: string, filePaths: string[]) => {
  return await gitService.stage(repoPath, filePaths)
})

ipcMain.handle('git:unstage', async (_, repoPath: string, filePaths: string[]) => {
  return await gitService.unstage(repoPath, filePaths)
})

ipcMain.handle('git:commit', async (_, repoPath: string, message: string) => {
  return await gitService.commit(repoPath, message)
})

ipcMain.handle('git:checkout', async (_, repoPath: string, target: string, createBranch?: boolean) => {
  return await gitService.checkout(repoPath, target, createBranch)
})

ipcMain.handle('git:createBranch', async (_, repoPath: string, branchName: string, from?: string) => {
  return await gitService.createBranch(repoPath, branchName, from)
})

ipcMain.handle('git:push', async (_, repoPath: string, remote?: string, branch?: string) => {
  return await gitService.push(repoPath, remote, branch)
})

ipcMain.handle('git:pull', async (_, repoPath: string, remote?: string, branch?: string) => {
  return await gitService.pull(repoPath, remote, branch)
})

ipcMain.handle('git:fetch', async (_, repoPath: string, remote?: string) => {
  return await gitService.fetch(repoPath, remote)
})

ipcMain.handle('git:merge', async (_, repoPath: string, branchName: string) => {
  return await gitService.merge(repoPath, branchName)
})

ipcMain.handle('git:rebase', async (_, repoPath: string, branchName: string) => {
  return await gitService.rebase(repoPath, branchName)
})

ipcMain.handle('git:deleteBranch', async (_, repoPath: string, branchName: string, force?: boolean) => {
  return await gitService.deleteBranch(repoPath, branchName, force)
})

ipcMain.handle('git:renameBranch', async (_, repoPath: string, oldName: string, newName: string) => {
  return await gitService.renameBranch(repoPath, oldName, newName)
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

// Save session tabs on quit
app.on('before-quit', async () => {
  const windows = BrowserWindow.getAllWindows()
  for (const w of windows) {
    try {
      const tabs: string[] = await w.webContents.executeJavaScript(
        'window.__sessionTabs || []'
      )
      if (tabs.length > 0) {
        configService.saveSessionTabs(tabs)
      }
    } catch (e) {
      // ignore
    }
  }
})

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const iconPath = getResourcePath('resources/icon.png')
    app.dock.setIcon(iconPath)
  }
  createWindow()
})
