import React, { useEffect, useMemo, useState } from 'react'
import type { DiffFile, DiffLine, DiffHunk } from '@git-types/git'

interface DiffViewerProps {
  files: DiffFile[]
  title: string
  initialSelectedPath?: string
  onClose: () => void
}

interface RenderLine {
  type: DiffLine['type']
  content: string
  oldLineNumber: number | null
  newLineNumber: number | null
}

const DiffViewer: React.FC<DiffViewerProps> = ({
  files,
  title,
  initialSelectedPath,
  onClose
}) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    if (initialSelectedPath && files.some((f) => f.path === initialSelectedPath)) {
      setSelectedPath(initialSelectedPath)
    } else if (files.length > 0) {
      setSelectedPath(files[0].path)
    } else {
      setSelectedPath(null)
    }
  }, [files, initialSelectedPath])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const selectedFile = useMemo(
    () => files.find((f) => f.path === selectedPath) || null,
    [files, selectedPath]
  )

  const renderHunk = (hunk: DiffHunk): RenderLine[] => {
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart
    const result: RenderLine[] = []

    hunk.lines.forEach((line) => {
      if (line.type === 'header') {
        result.push({
          type: 'header',
          content: line.content,
          oldLineNumber: null,
          newLineNumber: null
        })
        return
      }

      if (line.type === 'add') {
        result.push({
          type: 'add',
          content: line.content,
          oldLineNumber: null,
          newLineNumber: newLine
        })
        newLine += 1
      } else if (line.type === 'del') {
        result.push({
          type: 'del',
          content: line.content,
          oldLineNumber: oldLine,
          newLineNumber: null
        })
        oldLine += 1
      } else {
        result.push({
          type: 'normal',
          content: line.content,
          oldLineNumber: oldLine,
          newLineNumber: newLine
        })
        oldLine += 1
        newLine += 1
      }
    })

    return result
  }

  const renderLines = useMemo(() => {
    if (!selectedFile) return []
    return selectedFile.hunks.flatMap((hunk) => renderHunk(hunk))
  }, [selectedFile])

  const getStatusBadgeClass = (status: DiffFile['status']) => {
    switch (status) {
      case 'added':
        return 'bg-green-100 text-green-700'
      case 'deleted':
        return 'bg-red-100 text-red-700'
      case 'renamed':
        return 'bg-blue-100 text-blue-700'
      case 'copied':
        return 'bg-purple-100 text-purple-700'
      default:
        return 'bg-yellow-100 text-yellow-700'
    }
  }

  const getStatusLabel = (status: DiffFile['status']) => {
    switch (status) {
      case 'added':
        return 'A'
      case 'deleted':
        return 'D'
      case 'renamed':
        return 'R'
      case 'copied':
        return 'C'
      default:
        return 'M'
    }
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white flex-shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <span className="text-lg font-semibold truncate">{title}</span>
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition p-1"
          title="Back to Commit History (Esc)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden flex-col bg-white">
        {selectedFile ? (
          <>
            <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2 min-w-0">
                <span
                  className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded ${getStatusBadgeClass(
                    selectedFile.status
                  )}`}
                >
                  {getStatusLabel(selectedFile.status)}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate">
                  {selectedFile.path}
                </span>
                {selectedFile.oldPath && selectedFile.oldPath !== selectedFile.path && (
                  <span className="text-xs text-gray-500 truncate">
                    ← {selectedFile.oldPath}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              {renderLines.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                  No diff content
                </div>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {renderLines.map((line, index) => {
                      if (line.type === 'header') {
                        return (
                          <tr key={index} className="bg-gray-100 text-gray-600">
                            <td className="px-3 py-1 text-right text-xs font-mono text-gray-400 w-16 select-none">
                              ...
                            </td>
                            <td className="px-3 py-1 text-right text-xs font-mono text-gray-400 w-16 select-none">
                              ...
                            </td>
                            <td className="px-3 py-1 text-xs font-mono font-semibold whitespace-pre">
                              {line.content}
                            </td>
                          </tr>
                        )
                      }

                      const lineClass =
                        line.type === 'add'
                          ? 'bg-green-50'
                          : line.type === 'del'
                            ? 'bg-red-50'
                            : 'bg-white'

                      const textClass =
                        line.type === 'add'
                          ? 'text-green-800'
                          : line.type === 'del'
                            ? 'text-red-800'
                            : 'text-gray-700'

                      const prefix =
                        line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '

                      return (
                        <tr key={index} className={lineClass}>
                          <td className="px-3 py-0.5 text-right text-xs font-mono text-gray-400 w-16 select-none border-r border-gray-200">
                            {line.oldLineNumber ?? ''}
                          </td>
                          <td className="px-3 py-0.5 text-right text-xs font-mono text-gray-400 w-16 select-none border-r border-gray-200">
                            {line.newLineNumber ?? ''}
                          </td>
                          <td className="px-3 py-0.5 text-xs font-mono whitespace-pre">
                            <span className={`${textClass} mr-1 select-none`}>{prefix}</span>
                            <span className={textClass}>{line.content}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a file to view diff
          </div>
        )}
      </div>
    </div>
  )
}

export default DiffViewer
