import { useState, useEffect, useCallback, useRef } from 'react'
import type { CommitInfo, BranchInfo, GitStatus, DiffFile } from '@git-types/git'
import type { RepoTab } from './types'
import TabBar from './components/TabBar'
import RepoView from './components/RepoView'

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getRepoName(repoPath: string): string {
  return repoPath.split('/').pop() || repoPath
}

function createEmptyTab(repoPath: string): RepoTab {
  return {
    id: generateTabId(),
    repoPath,
    name: getRepoName(repoPath),
    branches: [],
    commits: [],
    selectedCommit: null,
    status: null,
    diff: [],
    loading: false,
    error: ''
  }
}

function App(): JSX.Element {
  const [tabs, setTabs] = useState<RepoTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [recentRepos, setRecentRepos] = useState<string[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const tabsRef = useRef(tabs)
  const activeTabRef = useRef(activeTabId)
  tabsRef.current = tabs
  activeTabRef.current = activeTabId

  // Load recent repos on mount
  useEffect(() => {
    const load = async () => {
      try {
        const repos = await window.electronAPI.config.getRecentRepos()
        setRecentRepos(repos)
      } catch (e) {
        console.error('Failed to load recent repos:', e)
      } finally {
        setLoadingRecent(false)
      }
    }
    load()
  }, [])

  // Restore session tabs on mount
  useEffect(() => {
    const restore = async () => {
      try {
        const sessionPaths = await window.electronAPI.config.getSessionTabs()
        if (sessionPaths.length > 0) {
          for (const repoPath of sessionPaths) {
            await addTab(repoPath, false)
          }
        }
      } catch (e) {
        console.error('Failed to restore session tabs:', e)
      }
    }
    restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update global session tabs for main process to save on quit
  useEffect(() => {
    window.__sessionTabs = tabs.map((t) => t.repoPath)
    // Also save proactively via IPC
    if (tabs.length > 0) {
      window.electronAPI.config.saveSessionTabs(tabs.map((t) => t.repoPath)).catch(() => {})
    }
  }, [tabs])

  const updateTab = useCallback(
    (tabId: string, updater: (tab: RepoTab) => RepoTab) => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? updater({ ...t }) : t)))
    },
    []
  )

  const refreshData = useCallback(
    async (repoPath: string, targetTabId?: string) => {
      const currentTabs = tabsRef.current
      const tabId = targetTabId || currentTabs.find((t) => t.repoPath === repoPath)?.id
      if (!tabId) return

      try {
        updateTab(tabId, (t) => ({ ...t, loading: true, error: '' }))

        const [branchesData, logData, statusData] = await Promise.all([
          window.electronAPI.git.getBranches(repoPath),
          window.electronAPI.git.getLog(repoPath, 200),
          window.electronAPI.git.getStatus(repoPath)
        ])

        updateTab(tabId, (t) => {
          const newTab: RepoTab = {
            ...t,
            branches: branchesData,
            commits: logData,
            status: statusData,
            loading: false
          }

          // Auto-select HEAD commit for current branch when no commit is selected
          if (logData.length > 0 && !t.selectedCommit) {
            const currentBranch = statusData.current
            const headCommit = logData.find(c => c.refs.includes(`HEAD -> ${currentBranch}`)) || logData[0]
            newTab.selectedCommit = headCommit
            // Load diff asynchronously
            window.electronAPI.git.getCommitDiff(repoPath, headCommit.hash).then((diffData) => {
              updateTab(tabId, (tt) => ({ ...tt, diff: diffData }))
            })
          }
          return newTab
        })
      } catch (err: any) {
        updateTab(tabId, (t) => ({ ...t, error: err.message || 'Failed to refresh data', loading: false }))
      }
    },
    [updateTab]
  )

  const addTab = useCallback(
    async (repoPath: string, doRefresh = true) => {
      try {
        const info = await window.electronAPI.git.openRepo(repoPath)
        if (!info.valid) {
          alert('Selected directory is not a valid Git repository')
          return
        }

        // Add to recent repos
        await window.electronAPI.config.addRecentRepo(repoPath)
        setRecentRepos((prev) => {
          const filtered = prev.filter((r) => r !== repoPath)
          filtered.unshift(repoPath)
          return filtered.slice(0, 10)
        })

        const newTab = createEmptyTab(repoPath)
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(newTab.id)

        if (doRefresh) {
          await refreshData(repoPath, newTab.id)
        }
      } catch (err: any) {
        alert(err.message || 'Failed to open repository')
      }
    },
    [refreshData]
  )

  const handleOpenRepo = async () => {
    try {
      const path = await window.electronAPI.openDirectory()
      if (!path) return
      await addTab(path)
    } catch (err: any) {
      alert(err.message || 'Failed to open repository')
    }
  }

  const handleOpenRecent = async (repoPath: string) => {
    // Check if already open in a tab
    const existing = tabsRef.current.find((t) => t.repoPath === repoPath)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }
    await addTab(repoPath)
  }

  const handleNewTab = () => {
    handleOpenRepo()
  }

  const handleTabClick = (id: string) => {
    setActiveTabId(id)
  }

  const handleTabClose = useCallback(
    (id: string) => {
      const currentTabs = tabsRef.current
      const idx = currentTabs.findIndex((t) => t.id === id)
      if (idx === -1) return

      const tab = currentTabs[idx]
      // Close git connection
      window.electronAPI.git.closeRepo(tab.repoPath).catch(() => {})

      const newTabs = currentTabs.filter((t) => t.id !== id)
      setTabs(newTabs)

      if (activeTabRef.current === id) {
        if (newTabs.length > 0) {
          const newActive = newTabs[Math.min(idx, newTabs.length - 1)]
          setActiveTabId(newActive.id)
        } else {
          setActiveTabId(null)
        }
      }
    },
    []
  )

  const handleCommitSelect = useCallback(
    async (repoPath: string, commit: CommitInfo) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      updateTab(tab.id, (t) => ({ ...t, selectedCommit: commit }))
      try {
        const diffData = await window.electronAPI.git.getCommitDiff(repoPath, commit.hash)
        updateTab(tab.id, (t) => ({ ...t, diff: diffData }))
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to load diff' }))
      }
    },
    [updateTab]
  )

  const handleCheckout = useCallback(
    async (repoPath: string, branchName: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true, error: '' }))
        await window.electronAPI.git.checkout(repoPath, branchName)

        const [branchesData, logData, statusData] = await Promise.all([
          window.electronAPI.git.getBranches(repoPath),
          window.electronAPI.git.getLog(repoPath, 200),
          window.electronAPI.git.getStatus(repoPath)
        ])

        const currentBranchName = statusData.current || branchName
        const headCommit =
          logData.find((c: CommitInfo) => c.refs.includes(`HEAD -> ${currentBranchName}`)) || logData[0]

        let diffData: DiffFile[] = []
        if (headCommit) {
          diffData = await window.electronAPI.git.getCommitDiff(repoPath, headCommit.hash)
        }

        updateTab(tab.id, (t) => ({
          ...t,
          branches: branchesData,
          commits: logData,
          status: statusData,
          selectedCommit: headCommit || null,
          diff: diffData,
          loading: false
        }))
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to checkout', loading: false }))
      }
    },
    [updateTab]
  )

  const handlePush = useCallback(
    async (repoPath: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.push(repoPath)
        updateTab(tab.id, (t) => ({ ...t, loading: false }))
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to push', loading: false }))
      }
    },
    [updateTab]
  )

  const handlePull = useCallback(
    async (repoPath: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.pull(repoPath)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to pull', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleFetch = useCallback(
    async (repoPath: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.fetch(repoPath)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to fetch', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleMerge = useCallback(
    async (repoPath: string, branchName: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.merge(repoPath, branchName)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to merge', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleRebase = useCallback(
    async (repoPath: string, branchName: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.rebase(repoPath, branchName)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to rebase', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleDeleteBranch = useCallback(
    async (repoPath: string, branchName: string, force: boolean) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.deleteBranch(repoPath, branchName, force)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to delete branch', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleRenameBranch = useCallback(
    async (repoPath: string, oldName: string, newName: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.renameBranch(repoPath, oldName, newName)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to rename branch', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleCreateBranch = useCallback(
    async (repoPath: string, branchName: string) => {
      const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
      if (!tab) return
      try {
        updateTab(tab.id, (t) => ({ ...t, loading: true }))
        await window.electronAPI.git.createBranch(repoPath, branchName)
        await refreshData(repoPath, tab.id)
      } catch (err: any) {
        updateTab(tab.id, (t) => ({ ...t, error: err.message || 'Failed to create branch', loading: false }))
      }
    },
    [refreshData, updateTab]
  )

  const handleStage = useCallback(
    async (repoPath: string, filePaths: string[]) => {
      await window.electronAPI.git.stage(repoPath, filePaths)
    },
    []
  )

  const handleUnstage = useCallback(
    async (repoPath: string, filePaths: string[]) => {
      await window.electronAPI.git.unstage(repoPath, filePaths)
    },
    []
  )

  const handleCommit = useCallback(
    async (repoPath: string, message: string) => {
      await window.electronAPI.git.commit(repoPath, message)
    },
    []
  )

  const handleClearError = useCallback((repoPath: string) => {
    const tab = tabsRef.current.find((t) => t.repoPath === repoPath)
    if (!tab) return
    updateTab(tab.id, (t) => ({ ...t, error: '' }))
  }, [updateTab])

  const activeTab = tabs.find((t) => t.id === activeTabId) || null

  // No tabs: show welcome screen with recent repos
  if (!activeTab) {
    return (
      <div className="flex flex-col h-screen bg-gray-50">
        <div className="flex items-center h-9 bg-gray-800 border-b border-gray-700 select-none">
          <div className="flex flex-1 overflow-x-auto">
            {/* No tabs */}
          </div>
          <button
            onClick={handleNewTab}
            className="flex items-center justify-center w-9 h-9 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-lg"
            title="New tab"
          >
            +
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-lg w-full px-6">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">GitHydra</h1>
            <p className="text-gray-500 mb-8">Simple Git GUI Client</p>
            <button
              onClick={handleOpenRepo}
              disabled={loadingRecent}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {loadingRecent ? 'Loading...' : 'Open Repository'}
            </button>

            {recentRepos.length > 0 && (
              <div className="mt-10 text-left">
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Recent Repositories
                </h2>
                <div className="space-y-1">
                  {recentRepos.map((repoPath) => (
                    <button
                      key={repoPath}
                      onClick={() => handleOpenRecent(repoPath)}
                      className="w-full text-left px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition text-sm text-gray-700"
                    >
                      <div className="font-medium">{getRepoName(repoPath)}</div>
                      <div className="text-xs text-gray-400 truncate">{repoPath}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <TabBar
        tabs={tabs.map((t) => ({ id: t.id, name: t.name, repoPath: t.repoPath }))}
        activeTabId={activeTabId}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onNewTab={handleNewTab}
      />
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={tab.id === activeTabId ? 'h-full' : 'hidden'}
          >
            <RepoView
              repoPath={tab.repoPath}
              name={tab.name}
              branches={tab.branches}
              commits={tab.commits}
              selectedCommit={tab.selectedCommit}
              status={tab.status}
              diff={tab.diff}
              loading={tab.loading}
              error={tab.error}
              onRefresh={refreshData}
              onCommitSelect={handleCommitSelect}
              onStage={handleStage}
              onUnstage={handleUnstage}
              onCommit={handleCommit}
              onCheckout={handleCheckout}
              onMerge={handleMerge}
              onRebase={handleRebase}
              onDeleteBranch={handleDeleteBranch}
              onRenameBranch={handleRenameBranch}
              onPush={handlePush}
              onPull={handlePull}
              onFetch={handleFetch}
              onCreateBranch={handleCreateBranch}
              onClearError={handleClearError}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
