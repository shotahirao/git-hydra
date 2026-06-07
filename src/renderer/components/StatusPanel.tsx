import React, { useState, useEffect } from 'react'
import { GitStatus, FileStatus, DiffFile, DiffHunk, DiffLine } from '@git-types/git'

interface StatusPanelProps {
  status: GitStatus | null
  onStage: (filePaths: string[]) => void
  onUnstage: (filePaths: string[]) => void
  onCommit: (message: string) => void
}

const StatusPanel: React.FC<StatusPanelProps> = ({ status, onStage, onUnstage, onCommit }) => {
  const [commitMessage, setCommitMessage] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedFileIsStaged, setSelectedFileIsStaged] = useState(false)
  const [diff, setDiff] = useState<DiffFile[]>([])
  const [stagedExpanded, setStagedExpanded] = useState(true)
  const [unstagedExpanded, setUnstagedExpanded] = useState(true)

  // Load diff when file is selected
  useEffect(() => {
    if (!selectedFile) {
      setDiff([])
      return
    }

    const loadDiff = async () => {
      try {
        if (selectedFileIsStaged) {
          const diffData = await window.electronAPI.git.getStagedDiff(selectedFile)
          setDiff(diffData)
        } else {
          const diffData = await window.electronAPI.git.getWorkingDiff(selectedFile)
          setDiff(diffData)
        }
      } catch (err) {
        console.error('Failed to load diff:', err)
        setDiff([])
      }
    }

    loadDiff()
  }, [selectedFile, selectedFileIsStaged])

  // Auto-select first file when status changes
  useEffect(() => {
    if (!status) return
    
    const allFiles = [
      ...status.staged.map(f => ({ ...f, isStaged: true })),
      ...status.modified.map(f => ({ ...f, isStaged: false })),
      ...status.untracked.map(f => ({ ...f, isStaged: false }))
    ]
    
    if (allFiles.length > 0) {
      const firstFile = allFiles[0]
      if (selectedFile !== firstFile.path || selectedFileIsStaged !== firstFile.isStaged) {
        setSelectedFile(firstFile.path)
        setSelectedFileIsStaged(firstFile.isStaged)
      }
    } else {
      setSelectedFile(null)
      setDiff([])
    }
  }, [status])

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No repository open
      </div>
    )
  }

  const handleFileSelect = (file: FileStatus, isStaged: boolean) => {
    setSelectedFile(file.path)
    setSelectedFileIsStaged(isStaged)
  }

  const handleStage = (file: FileStatus) => {
    onStage([file.path])
    // After staging, select the staged version
    setSelectedFileIsStaged(true)
  }

  const handleUnstage = (file: FileStatus) => {
    onUnstage([file.path])
    // After unstaging, select the unstaged version
    setSelectedFileIsStaged(false)
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

  const hasChanges = status.staged.length > 0 || status.modified.length > 0 || status.untracked.length > 0
  const unstagedFiles = [...status.modified, ...status.untracked]

  return (
    <div className="flex flex-col h-full">
      {/* Main content: File list + Diff */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File List */}
        <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
          {/* Staged Files Section */}
          <div className="flex flex-col min-h-0" style={{ flex: status.staged.length > 0 ? 1 : '0 0 auto' }}>
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
              <div className="overflow-y-auto" style={{ maxHeight: status.staged.length > 0 ? '50%' : 'auto' }}>
                {status.staged.length === 0 && (
                  <div className="p-2 text-xs text-gray-400">No staged changes</div>
                )}
                {status.staged.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => handleFileSelect(file, true)}
                    className={`flex items-center px-3 py-1 cursor-pointer hover:bg-gray-100 ${
                      selectedFile === file.path && selectedFileIsStaged ? 'bg-blue-100' : ''
                    }`}
                  >
                    <span className={`text-xs font-mono w-4 mr-2 ${getStatusColor(file)}`}>
                      {getStatusIcon(file)}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{file.path}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnstage(file) }}
                      className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded opacity-0 group-hover:opacity-100 transition"
                      style={{ opacity: selectedFile === file.path ? 1 : undefined }}
                      title="Unstage"
                    >
                      −
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unstaged Files Section */}
          <div className="flex flex-col min-h-0 flex-1">
            <div 
              className="px-3 py-1.5 bg-gray-100 border-b border-t border-gray-200 flex justify-between items-center cursor-pointer hover:bg-gray-200"
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
                {unstagedFiles.length === 0 && (
                  <div className="p-2 text-xs text-gray-400">No changes</div>
                )}
                {unstagedFiles.map((file) => (
                  <div
                    key={file.path}
                    onClick={() => handleFileSelect(file, false)}
                    className={`flex items-center px-3 py-1 cursor-pointer hover:bg-gray-100 group ${
                      selectedFile === file.path && !selectedFileIsStaged ? 'bg-blue-100' : ''
                    }`}
                  >
                    <span className={`text-xs font-mono w-4 mr-2 ${getStatusColor(file)}`}>
                      {getStatusIcon(file)}
                    </span>
                    <span className="text-xs text-gray-700 truncate flex-1">{file.path}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStage(file) }}
                      className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded opacity-0 group-hover:opacity-100 transition"
                      style={{ opacity: selectedFile === file.path ? 1 : undefined }}
                      title="Stage"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Diff View */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedFile ? (
            <>
              <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-700 truncate">
                  {selectedFile}
                  <span className="ml-2 text-xs text-gray-500">
                    ({selectedFileIsStaged ? 'Staged' : 'Unstaged'})
                  </span>
                </span>
                <div className="flex space-x-1">
                  {selectedFileIsStaged ? (
                    <button
                      onClick={() => {
                        const file = status.staged.find(f => f.path === selectedFile)
                        if (file) handleUnstage(file)
                      }}
                      className="px-2 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 rounded transition"
                    >
                      − Unstage
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const file = unstagedFiles.find(f => f.path === selectedFile)
                        if (file) handleStage(file)
                      }}
                      className="px-2 py-0.5 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded transition"
                    >
                      + Stage
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {diff.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    No diff available
                  </div>
                ) : (
                  diff.map((file, fileIndex) => (
                    <div key={fileIndex}>
                      {file.hunks.map((hunk, hunkIndex) => (
                        <div key={hunkIndex} className="text-xs">
                          <div className="px-3 py-0.5 bg-gray-100 text-gray-500 font-mono text-[10px] border-b border-gray-200">
                            {hunk.lines[0]?.content}
                          </div>
                          {hunk.lines.slice(1).map((line, lineIndex) => (
                            <div
                              key={lineIndex}
                              className={`px-3 py-0.5 font-mono whitespace-pre ${
                                line.type === 'add' ? 'bg-green-50 text-green-800' :
                                line.type === 'del' ? 'bg-red-50 text-red-800' :
                                'text-gray-700'
                              }`}
                            >
                              {line.content}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              {hasChanges ? 'Select a file to view diff' : 'Working tree clean'}
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