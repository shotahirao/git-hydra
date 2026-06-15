import React, { useState } from 'react'
import { GitStatus, FileStatus } from '@git-types/git'

interface StatusPanelProps {
  status: GitStatus | null
  loading: boolean
  repoPath: string
  onStage: (filePaths: string[]) => void
  onUnstage: (filePaths: string[]) => void
  onCommit: (message: string) => void
  onOpenDiffViewer: (filePath: string, isStaged: boolean) => void
}

const StatusPanel: React.FC<StatusPanelProps> = ({
  status,
  loading,
  onStage,
  onUnstage,
  onCommit,
  onOpenDiffViewer
}) => {
  const [commitMessage, setCommitMessage] = useState('')
  const [stagedExpanded, setStagedExpanded] = useState(true)
  const [unstagedExpanded, setUnstagedExpanded] = useState(true)

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        {loading ? (
          <>
            <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-2 text-sm text-gray-500">Loading repository data...</p>
          </>
        ) : (
          <span className="text-gray-400 text-sm">No repository open</span>
        )}
      </div>
    )
  }

  const handleFileClick = (file: FileStatus, isStaged: boolean) => {
    onOpenDiffViewer(file.path, isStaged)
  }

  const handleStage = (file: FileStatus) => {
    onStage([file.path])
  }

  const handleUnstage = (file: FileStatus) => {
    onUnstage([file.path])
  }

  const handleStageAll = () => {
    const allPaths = [...status.modified.map(f => f.path), ...status.untracked.map(f => f.path)]
    if (allPaths.length > 0) {
      onStage(allPaths)
    }
  }

  const handleUnstageAll = () => {
    if (status.staged.length > 0) {
      onUnstage(status.staged.map(f => f.path))
    }
  }

  const handleCommit = () => {
    if (commitMessage.trim() && status.staged.length > 0) {
      onCommit(commitMessage.trim())
      setCommitMessage('')
    }
  }

  const getStatusIcon = (file: FileStatus) => {
    if (file.status === 'added') return 'A'
    if (file.status === 'deleted') return 'D'
    if (file.status === 'modified') return 'M'
    if (file.status === 'renamed') return 'R'
    if (file.status === 'untracked') return '?'
    if (file.status === 'conflicted') return 'U'
    return file.index
  }

  const getStatusColor = (file: FileStatus) => {
    if (file.status === 'added') return 'text-green-600'
    if (file.status === 'deleted') return 'text-red-600'
    if (file.status === 'modified') return 'text-yellow-600'
    if (file.status === 'untracked') return 'text-gray-400'
    if (file.status === 'conflicted') return 'text-red-500'
    return 'text-gray-600'
  }

  const unstagedFiles = [...status.modified, ...status.untracked]

  return (
    <div className="flex flex-col h-full">
      {/* File list */}
      <div className="flex-1 overflow-hidden flex">
        {/* Staged Files Section */}
        <div className="flex flex-col min-h-0 border-r border-gray-200" style={{ flex: status.staged.length > 0 ? 1 : '0 0 auto', minWidth: status.staged.length > 0 ? '200px' : 'auto' }}>
          <div
            className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-200"
            onClick={() => setStagedExpanded(!stagedExpanded)}
          >
            <span className="text-xs font-semibold text-gray-700">
              Staged Changes {status.staged.length > 0 && `(${status.staged.length})`}
            </span>
            <div className="flex items-center space-x-1">
              {status.staged.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnstageAll() }}
                  className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded transition"
                  title="Unstage all"
                >
                  −
                </button>
              )}
              <span className="text-xs text-gray-400">{stagedExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {stagedExpanded && (
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {status.staged.length === 0 ? (
                <div className="p-2 text-xs text-gray-400">No staged changes</div>
              ) : (
                status.staged.map((file) => (
                  <div
                    key={file.path}
                    className="group flex items-center px-3 py-1.5 cursor-pointer hover:bg-blue-50 transition border-b border-gray-100"
                    onClick={() => handleFileClick(file, true)}
                  >
                    <span className={`text-xs font-mono w-4 mr-2 ${getStatusColor(file)}`}>
                      {getStatusIcon(file)}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{file.path}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnstage(file) }}
                      className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded opacity-0 group-hover:opacity-100 transition"
                      title="Unstage"
                    >
                      −
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Unstaged Files Section */}
        <div className="flex flex-col min-h-0 flex-1 bg-gray-50">
          <div
            className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-200"
            onClick={() => setUnstagedExpanded(!unstagedExpanded)}
          >
            <span className="text-xs font-semibold text-gray-700">
              Changes {unstagedFiles.length > 0 && `(${unstagedFiles.length})`}
            </span>
            <div className="flex items-center space-x-1">
              {unstagedFiles.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStageAll() }}
                  className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition"
                  title="Stage all"
                >
                  +
                </button>
              )}
              <span className="text-xs text-gray-400">{unstagedExpanded ? '▼' : '▶'}</span>
            </div>
          </div>

          {unstagedExpanded && (
            <div className="flex-1 overflow-y-auto">
              {unstagedFiles.length === 0 ? (
                <div className="p-2 text-xs text-gray-400">No changes</div>
              ) : (
                unstagedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="group flex items-center px-3 py-1.5 cursor-pointer hover:bg-blue-50 transition border-b border-gray-100"
                    onClick={() => handleFileClick(file, false)}
                  >
                    <span className={`text-xs font-mono w-4 mr-2 ${getStatusColor(file)}`}>
                      {getStatusIcon(file)}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{file.path}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStage(file) }}
                      className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded opacity-0 group-hover:opacity-100 transition"
                      title="Stage"
                    >
                      +
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Commit Area */}
      <div className="h-20 border-t border-gray-200 bg-gray-50 flex items-center px-4 space-x-3 flex-shrink-0">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="flex-1 h-12 p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={1}
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || status.staged.length === 0}
          className="px-6 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          Commit
        </button>
        <div className="text-xs text-gray-500 min-w-[80px] text-right">
          {status.staged.length > 0 && `${status.staged.length} staged`}
        </div>
      </div>
    </div>
  )
}

export default StatusPanel
