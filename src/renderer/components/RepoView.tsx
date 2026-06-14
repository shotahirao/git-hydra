import React, { useCallback, useEffect, useRef } from 'react'
import type { CommitInfo, BranchInfo, GitStatus, DiffFile } from '@git-types/git'
import BranchList from './BranchList'
import CommitGraph from './CommitGraph'
import CommitDetail from './CommitDetail'
import StatusPanel from './StatusPanel'

interface RepoViewProps {
  repoPath: string
  name: string
  branches: BranchInfo[]
  commits: CommitInfo[]
  visibleCommitCount: number
  loadedAllCommits: boolean
  selectedCommit: CommitInfo | null
  status: GitStatus | null
  diff: DiffFile[]
  loading: boolean
  error: string
  onRefresh: (repoPath: string) => Promise<void>
  onCommitSelect: (repoPath: string, commit: CommitInfo) => void
  onLoadMoreCommits: (repoPath: string) => void
  onStage: (repoPath: string, filePaths: string[]) => Promise<void>
  onUnstage: (repoPath: string, filePaths: string[]) => Promise<void>
  onCommit: (repoPath: string, message: string) => Promise<void>
  onCheckout: (repoPath: string, branchName: string) => Promise<void>
  onMerge: (repoPath: string, branchName: string) => Promise<void>
  onRebase: (repoPath: string, branchName: string) => Promise<void>
  onDeleteBranch: (repoPath: string, branchName: string, force: boolean) => Promise<void>
  onRenameBranch: (repoPath: string, oldName: string, newName: string) => Promise<void>
  onPush: (repoPath: string) => Promise<void>
  onPull: (repoPath: string) => Promise<void>
  onFetch: (repoPath: string) => Promise<void>
  onCreateBranch: (repoPath: string, branchName: string) => Promise<void>
  onClearError: (repoPath: string) => void
}

const RepoView: React.FC<RepoViewProps> = ({
  repoPath,
  branches,
  commits,
  visibleCommitCount,
  loadedAllCommits,
  selectedCommit,
  status,
  diff,
  loading,
  error,
  onRefresh,
  onCommitSelect,
  onLoadMoreCommits,
  onStage,
  onUnstage,
  onCommit,
  onCheckout,
  onMerge,
  onRebase,
  onDeleteBranch,
  onRenameBranch,
  onPush,
  onPull,
  onFetch,
  onCreateBranch,
  onClearError
}) => {
  const commitsRef = useRef<CommitInfo[]>(commits)

  // Poll for updates every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      onRefresh(repoPath)
    }, 15000)
    return () => clearInterval(interval)
  }, [repoPath, onRefresh])

  const handleCommitSelect = useCallback(async (commit: CommitInfo) => {
    onCommitSelect(repoPath, commit)
  }, [repoPath, onCommitSelect])

  const handleStage = useCallback(async (filePaths: string[]) => {
    await onStage(repoPath, filePaths)
    await onRefresh(repoPath)
  }, [repoPath, onStage, onRefresh])

  const handleUnstage = useCallback(async (filePaths: string[]) => {
    await onUnstage(repoPath, filePaths)
    await onRefresh(repoPath)
  }, [repoPath, onUnstage, onRefresh])

  const handleCommit = useCallback(async (message: string) => {
    await onCommit(repoPath, message)
    await onRefresh(repoPath)
  }, [repoPath, onCommit, onRefresh])

  const handleCheckout = useCallback(async (branchName: string) => {
    await onCheckout(repoPath, branchName)
  }, [repoPath, onCheckout])

  const handleMerge = useCallback(async (branchName: string) => {
    await onMerge(repoPath, branchName)
    await onRefresh(repoPath)
  }, [repoPath, onMerge, onRefresh])

  const handleRebase = useCallback(async (branchName: string) => {
    await onRebase(repoPath, branchName)
    await onRefresh(repoPath)
  }, [repoPath, onRebase, onRefresh])

  const handleDeleteBranch = useCallback(async (branchName: string, force: boolean) => {
    await onDeleteBranch(repoPath, branchName, force)
    await onRefresh(repoPath)
  }, [repoPath, onDeleteBranch, onRefresh])

  const handleRenameBranch = useCallback(async (oldName: string, newName: string) => {
    await onRenameBranch(repoPath, oldName, newName)
    await onRefresh(repoPath)
  }, [repoPath, onRenameBranch, onRefresh])

  const handlePush = useCallback(async () => {
    await onPush(repoPath)
  }, [repoPath, onPush])

  const handlePull = useCallback(async () => {
    await onPull(repoPath)
    await onRefresh(repoPath)
  }, [repoPath, onPull, onRefresh])

  const handleFetch = useCallback(async () => {
    await onFetch(repoPath)
    await onRefresh(repoPath)
  }, [repoPath, onFetch, onRefresh])

  const handleCreateBranch = useCallback(async (branchName: string) => {
    await onCreateBranch(repoPath, branchName)
    await onRefresh(repoPath)
  }, [repoPath, onCreateBranch, onRefresh])

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="h-12 bg-gray-900 text-white flex items-center px-4 justify-between flex-shrink-0">
        <div className="flex items-center space-x-4">
          <span className="font-bold text-lg">GitHydra</span>
          <span className="text-gray-400 text-sm truncate max-w-md">{repoPath}</span>
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
          <button onClick={() => onClearError(repoPath)} className="text-red-500 hover:text-red-700">×</button>
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
            loading={loading}
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
            visibleCommitCount={visibleCommitCount}
            loadedAllCommits={loadedAllCommits}
            selectedCommit={selectedCommit}
            currentBranch={status?.current}
            loading={loading}
            onCommitSelect={handleCommitSelect}
            onLoadMore={() => onLoadMoreCommits(repoPath)}
          />
        </div>

        {/* Right: Commit Detail / Diff */}
        <div className="w-[450px] flex flex-col bg-white">
          <CommitDetail
            commit={selectedCommit}
            diff={diff}
            loading={loading}
          />
        </div>
      </div>

      {/* Bottom: Status Panel */}
      <div className="h-96 border-t border-gray-200 flex-shrink-0">
        <StatusPanel
          status={status}
          loading={loading}
          repoPath={repoPath}
          onStage={handleStage}
          onUnstage={handleUnstage}
          onCommit={handleCommit}
        />
      </div>
    </div>
  )
}

export default RepoView
