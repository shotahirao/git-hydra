import React from 'react'
import { CommitInfo, DiffFile } from '@git-types/git'

interface CommitDetailProps {
  commit: CommitInfo | null
  diff: DiffFile[]
  loading: boolean
  onOpenDiffViewer: (filePath: string) => void
}

const CommitDetail: React.FC<CommitDetailProps> = ({ commit, diff, loading, onOpenDiffViewer }) => {
  if (!commit) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
          Details
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          {loading ? (
            <>
              <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="mt-2 text-sm text-gray-500">Loading commits...</p>
            </>
          ) : (
            <span className="text-gray-400 text-sm">Select a commit to view details</span>
          )}
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('ja-JP')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
        Commit Details
      </div>
      
      {/* Commit Info */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="text-sm font-semibold text-gray-800 mb-1 break-words">
          {commit.message}
        </div>
        <div className="text-xs text-gray-600 mb-0.5">
          <span className="font-medium">Author:</span> {commit.author_name} &lt;{commit.author_email}&gt;
        </div>
        <div className="text-xs text-gray-600 mb-0.5">
          <span className="font-medium">Date:</span> {formatDate(commit.date)}
        </div>
        <div className="text-xs text-gray-600">
          <span className="font-medium">Hash:</span> <span className="font-mono">{commit.hash}</span>
        </div>
        {commit.parents.length > 0 && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Parents:</span>{' '}
            {commit.parents.map(p => (
              <span key={p} className="font-mono mr-2">{p.substring(0, 7)}</span>
            ))}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600 flex justify-between items-center">
          <span>Changed Files ({diff.length})</span>
          <span className="text-[10px] text-gray-400 font-normal">Click a file to view diff</span>
        </div>

        {loading && diff.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-2 text-sm text-gray-500">Loading diff...</p>
          </div>
        ) : (
          <>
            {diff.length === 0 && (
              <div className="p-3 text-sm text-gray-500">No changes to display</div>
            )}
            {diff.map((file) => {
              const statusColor =
                file.status === 'added'
                  ? 'bg-green-100 text-green-700'
                  : file.status === 'deleted'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-blue-100 text-blue-700'
              const statusLabel =
                file.status === 'added'
                  ? 'A'
                  : file.status === 'deleted'
                    ? 'D'
                    : file.status === 'renamed'
                      ? 'R'
                      : file.status === 'copied'
                        ? 'C'
                        : 'M'

              return (
                <button
                  key={file.path}
                  onClick={() => onOpenDiffViewer(file.path)}
                  className="w-full text-left px-3 py-2 flex items-center space-x-2 hover:bg-blue-50 transition border-b border-gray-100"
                  title="Click to view diff"
                >
                  <span
                    className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                  <span className="text-xs text-gray-700 truncate flex-1">{file.path}</span>
                </button>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

export default CommitDetail
