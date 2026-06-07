import React, { useState } from 'react'
import { GitStatus, FileStatus } from '@git-types/git'

interface StatusPanelProps {
  status: GitStatus | null
  onStage: (filePaths: string[]) => void
  onUnstage: (filePaths: string[]) => void
  onCommit: (message: string) => void
}

const StatusPanel: React.FC<StatusPanelProps> = ({ status, onStage, onUnstage, onCommit }) => {
  const [commitMessage, setCommitMessage] = useState('')
  const [selectedStaged, setSelectedStaged] = useState<Set<string>>(new Set())
  const [selectedUnstaged, setSelectedUnstaged] = useState<Set<string>>(new Set())

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No repository open
      </div>
    )
  }

  const hasChanges = status.staged.length > 0 || status.modified.length > 0 || status.untracked.length > 0

  const toggleSelection = (set: Set<string>, path: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const newSet = new Set(set)
    if (newSet.has(path)) {
      newSet.delete(path)
    } else {
      newSet.add(path)
    }
    setter(newSet)
  }

  const handleStageSelected = () => {
    if (selectedUnstaged.size > 0) {
      onStage(Array.from(selectedUnstaged))
      setSelectedUnstaged(new Set())
    }
  }

  const handleStageAll = () => {
    const allPaths = [...status.modified.map(f => f.path), ...status.untracked.map(f => f.path)]
    if (allPaths.length > 0) {
      onStage(allPaths)
    }
  }

  const handleUnstageSelected = () => {
    if (selectedStaged.size > 0) {
      onUnstage(Array.from(selectedStaged))
      setSelectedStaged(new Set())
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

  return (
    <div className="flex h-full">
      {/* Staged files */}
      <div className="flex-1 border-r border-gray-200 flex flex-col">
        <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-700">
            Staged Changes ({status.staged.length})
          </span>
          <div className="space-x-1">
            {selectedStaged.size > 0 && (
              <button
                onClick={handleUnstageSelected}
                className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                − Selected
              </button>
            )}
            {status.staged.length > 0 && (
              <button
                onClick={handleUnstageAll}
                className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded transition"
              >
                − All
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {status.staged.length === 0 && (
            <div className="p-2 text-xs text-gray-400">No staged changes</div>
          )}
          {status.staged.map((file) => (
            <div
              key={file.path}
              onClick={() => toggleSelection(selectedStaged, file.path, setSelectedStaged)}
              className={`flex items-center px-3 py-1 cursor-pointer hover:bg-gray-50 ${
                selectedStaged.has(file.path) ? 'bg-blue-50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedStaged.has(file.path)}
                onChange={() => {}}
                className="mr-2"
              />
              <span className={`text-xs font-mono w-4 mr-2 ${getStatusColor(file)}`}>
                {getStatusIcon(file)}
              </span>
              <span className="text-xs text-gray-700 truncate">{file.path}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unstaged files */}
      <div className="flex-1 border-r border-gray-200 flex flex-col">
        <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-700">
            Changes ({status.modified.length + status.untracked.length})
          </span>
          <div className="space-x-1">
            {(status.modified.length > 0 || status.untracked.length > 0) && (
              <button
                onClick={handleStageAll}
                className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition"
              >
                + All
              </button>
            )}
            {selectedUnstaged.size > 0 && (
              <button
                onClick={handleStageSelected}
                className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition"
              >
                + Selected
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {status.modified.length === 0 && status.untracked.length === 0 && (
            <div className="p-2 text-xs text-gray-400">No changes</div>
          )}
          {[...status.modified, ...status.untracked].map((file) => (
            <div
              key={file.path}
              onClick={() => toggleSelection(selectedUnstaged, file.path, setSelectedUnstaged)}
              className={`flex items-center px-3 py-1 cursor-pointer hover:bg-gray-50 ${
                selectedUnstaged.has(file.path) ? 'bg-blue-50' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={selectedUnstaged.has(file.path)}
                onChange={() => {}}
                className="mr-2"
              />
              <span className={`text-xs font-mono w-4 mr-2 ${getStatusColor(file)}`}>
                {getStatusIcon(file)}
              </span>
              <span className="text-xs text-gray-700 truncate">{file.path}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Commit area */}
      <div className="w-80 flex flex-col p-2 bg-gray-50">
        <textarea
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="Commit message..."
          className="flex-1 w-full p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={3}
        />
        <button
          onClick={handleCommit}
          disabled={!commitMessage.trim() || status.staged.length === 0}
          className="mt-2 w-full px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Commit ({status.staged.length} files)
        </button>
        {!hasChanges && (
          <p className="mt-1 text-xs text-gray-400 text-center">Working tree clean</p>
        )}
      </div>
    </div>
  )
}

export default StatusPanel
