import React from 'react'
import { CommitInfo, DiffFile } from '@git-types/git'

interface CommitDetailProps {
  commit: CommitInfo | null
  diff: DiffFile[]
  loading: boolean
}

const CommitDetail: React.FC<CommitDetailProps> = ({ commit, diff, loading }) => {
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

      {/* Diff */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600">
          Changed Files ({diff.length})
        </div>
        
        {diff.length === 0 && (
          <div className="p-3 text-sm text-gray-500">No changes to display</div>
        )}
        
        {diff.map((file, fileIndex) => (
          <div key={fileIndex} className="border-b border-gray-200">
            <div className={`px-3 py-1.5 text-xs font-medium ${
              file.status === 'added' ? 'bg-green-50 text-green-700' :
              file.status === 'deleted' ? 'bg-red-50 text-red-700' :
              'bg-gray-50 text-gray-700'
            }`}>
              {file.path}
              <span className="ml-2 text-xs opacity-60">({file.status})</span>
            </div>
            
            {file.hunks.map((hunk, hunkIndex) => (
              <div key={hunkIndex} className="text-xs">
                <div className="px-3 py-0.5 bg-gray-100 text-gray-500 font-mono text-[10px]">
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
        ))}
      </div>
    </div>
  )
}

export default CommitDetail
