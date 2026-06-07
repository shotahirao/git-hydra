import { useState, useEffect, useCallback, useRef } from 'react'
import type { CommitInfo, BranchInfo, GitStatus, DiffFile } from '@git-types/git'
import BranchList from './components/BranchList'
import CommitGraph from './components/CommitGraph'
import CommitDetail from './components/CommitDetail'
import StatusPanel from './components/StatusPanel'

function App(): JSX.Element {
  const [repoPath, setRepoPath] = useState<string>('')
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [diff, setDiff] = useState<DiffFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const commitsRef = useRef<CommitInfo[]>([])

  const refreshData = useCallback(async () => {
    if (!repoPath) return
    try {
      const [branchesData, logData, statusData] = await Promise.all([
        window.electronAPI.git.getBranches(),
        window.electronAPI.git.getLog(200),
        window.electronAPI.git.getStatus()
      ])

      // Only update commits if they actually changed (prevents unnecessary re-renders)
      const currentHashes = commitsRef.current.map((c: CommitInfo) => c.hash).join(',')
      const newHashes = logData.map((c: CommitInfo) => c.hash).join(',')
      if (currentHashes !== newHashes) {
        commitsRef.current = logData
        setCommits(logData)
      }

      setBranches(branchesData)
      setStatus(statusData)

      // Auto-select HEAD commit (first in log) when data loads
      if (logData.length > 0 && !selectedCommit) {
        const headCommit = logData[0]
        setSelectedCommit(headCommit)
        const diffData = await window.electronAPI.git.getCommitDiff(headCommit.hash)
        setDiff(diffData)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data')
    }
  }, [repoPath, selectedCommit])

  const handleOpenRepo = async () => {
    try {
      setLoading(true)
      setError('')
      const path = await window.electronAPI.openDirectory()
      if (!path) {
        setLoading(false)
        return
      }
      const info = await window.electronAPI.git.openRepo(path)
      if (!info.valid) {
        setError('Selected directory is not a valid Git repository')
        setLoading(false)
        return
      }
      setRepoPath(path)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to open repository')
    } finally {
      setLoading(false)
    }
  }

  const handleCommitSelect = async (commit: CommitInfo) => {
    setSelectedCommit(commit)
    try {
      const diffData = await window.electronAPI.git.getCommitDiff(commit.hash)
      setDiff(diffData)
    } catch (err: any) {
      setError(err.message || 'Failed to load diff')
    }
  }

  const handleStage = async (filePaths: string[]) => {
    try {
      await window.electronAPI.git.stage(filePaths)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to stage files')
    }
  }

  const handleUnstage = async (filePaths: string[]) => {
    try {
      await window.electronAPI.git.unstage(filePaths)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to unstage files')
    }
  }

  const handleCommit = async (message: string) => {
    try {
      await window.electronAPI.git.commit(message)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to commit')
    }
  }

  const handleCheckout = async (branchName: string) => {
    try {
      setLoading(true)
      setError('')
      await window.electronAPI.git.checkout(branchName)

      // Fetch new branch data and auto-select HEAD commit
      const [branchesData, logData, statusData] = await Promise.all([
        window.electronAPI.git.getBranches(),
        window.electronAPI.git.getLog(200),
        window.electronAPI.git.getStatus()
      ])

      setBranches(branchesData)
      setCommits(logData)
      setStatus(statusData)

      // Auto-select HEAD commit of the new branch and scroll to it
      if (logData.length > 0) {
        const currentBranchName = statusData.current || branchName
        // Find the HEAD commit for the checked-out branch from refs
        // refs format: "HEAD -> main, origin/main" or "HEAD -> main"
        let headCommit = logData.find(c => c.refs.includes(`HEAD -> ${currentBranchName}`))

        // Fallback: if not found (e.g. detached HEAD or remote branch checkout), use first commit in log
        if (!headCommit) {
          headCommit = logData[0]
        }

        setSelectedCommit(headCommit)
        const diffData = await window.electronAPI.git.getCommitDiff(headCommit.hash)
        setDiff(diffData)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to checkout')
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async (branchName: string) => {
    try {
      setLoading(true)
      await window.electronAPI.git.merge(branchName)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to merge')
    } finally {
      setLoading(false)
    }
  }

  const handleRebase = async (branchName: string) => {
    try {
      setLoading(true)
      await window.electronAPI.git.rebase(branchName)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to rebase')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBranch = async (branchName: string, force: boolean) => {
    try {
      setLoading(true)
      await window.electronAPI.git.deleteBranch(branchName, force)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to delete branch')
    } finally {
      setLoading(false)
    }
  }

  const handleRenameBranch = async (oldName: string, newName: string) => {
    try {
      setLoading(true)
      await window.electronAPI.git.renameBranch(oldName, newName)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to rename branch')
    } finally {
      setLoading(false)
    }
  }

  const handlePush = async () => {
    try {
      setLoading(true)
      await window.electronAPI.git.push()
    } catch (err: any) {
      setError(err.message || 'Failed to push')
    } finally {
      setLoading(false)
    }
  }

  const handlePull = async () => {
    try {
      setLoading(true)
      await window.electronAPI.git.pull()
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to pull')
    } finally {
      setLoading(false)
    }
  }

  const handleFetch = async () => {
    try {
      setLoading(true)
      await window.electronAPI.git.fetch()
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBranch = async (branchName: string) => {
    try {
      setLoading(true)
      await window.electronAPI.git.createBranch(branchName)
      await refreshData()
    } catch (err: any) {
      setError(err.message || 'Failed to create branch')
    } finally {
      setLoading(false)
    }
  }

  // Poll for updates every 15 seconds (reduced from 5s to prevent scroll interference)
  useEffect(() => {
    const interval = setInterval(() => {
      if (repoPath) refreshData()
    }, 15000)
    return () => clearInterval(interval)
  }, [repoPath, refreshData])

  if (!repoPath) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">GitHydra</h1>
          <p className="text-gray-500 mb-6">Simple Git GUI Client</p>
          <button
            onClick={handleOpenRepo}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {loading ? 'Opening...' : 'Open Repository'}
          </button>
          {error && (
            <p className="mt-4 text-red-500 text-sm">{error}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="h-12 bg-gray-900 text-white flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-lg">GitHydra</span>
          <span className="text-gray-400 text-sm">{repoPath}</span>
        </div>
        <div className="flex items-center space-x-2">
          {status && (
            <span className="text-sm text-gray-300">
              {status.current}
              {status.tracking && (
                <span className="ml-2 text-xs">
                  {status.ahead > 0 && `+${status.ahead}`}
                  {status.behind > 0 && `-${status.behind}`}
                </span>
              )}
            </span>
          )}
          <button
            onClick={handleFetch}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
          >
            Fetch
          </button>
          <button
            onClick={handlePull}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm transition"
          >
            Pull
          </button>
          <button
            onClick={handlePush}
            className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm transition"
          >
            Push
          </button>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="bg-red-100 text-red-700 px-4 py-2 text-sm flex-shrink-0 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Loading bar */}
      {loading && (
        <div className="bg-blue-100 text-blue-700 px-4 py-1 text-xs flex-shrink-0">
          Loading...
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Branch List */}
        <div className="w-56 border-r border-gray-200 flex flex-col bg-gray-50">
          <BranchList
            branches={branches}
            currentBranch={status?.current}
            onCheckout={handleCheckout}
            onCreateBranch={handleCreateBranch}
            onMerge={handleMerge}
            onRebase={handleRebase}
            onDeleteBranch={handleDeleteBranch}
            onRenameBranch={handleRenameBranch}
          />
        </div>

        {/* Center: Commit Graph */}
        <div className="flex-1 border-r border-gray-200 flex flex-col min-w-0">
          <CommitGraph
            commits={commits}
            selectedCommit={selectedCommit}
            currentBranch={status?.current}
            onCommitSelect={handleCommitSelect}
          />
        </div>

        {/* Right: Commit Detail / Diff */}
        <div className="w-[450px] flex flex-col bg-white">
          <CommitDetail
            commit={selectedCommit}
            diff={diff}
          />
        </div>
      </div>

      {/* Bottom: Status Panel */}
      <div className="h-96 border-t border-gray-200 flex-shrink-0">
        <StatusPanel
          status={status}
          onStage={handleStage}
          onUnstage={handleUnstage}
          onCommit={handleCommit}
        />
      </div>
    </div>
  )
}

export default App
