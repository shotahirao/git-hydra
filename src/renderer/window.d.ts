import { ElectronAPI } from '../preload'

declare global {
  interface Window {
    electronAPI: ElectronAPI
    __sessionTabs?: string[]
  }
}
