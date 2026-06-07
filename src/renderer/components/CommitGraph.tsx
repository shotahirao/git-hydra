import React, { useMemo, useRef, useEffect } from 'react'
import { CommitInfo } from '@git-types/git'

interface CommitGraphProps {
  commits: CommitInfo[]
  selectedCommit: CommitInfo | null
  currentBranch?: string
  loading: boolean
  onCommitSelect: (commit: CommitInfo) => void
}

const ROW_HEIGHT = 32
const COLUMN_WIDTH = 14
const LEFT_PADDING = 16
const DOT_RADIUS = 5
const LINE_STROKE = 2

// Color palette for branches
const BRANCH_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#db2777', // pink
  '#65a30d', // lime
  '#7c3aed', // violet
  '#c2410c', // amber
]

function getBranchColor(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length]
}

const CommitGraph: React.FC<CommitGraphProps> = ({ commits, selectedCommit, currentBranch, loading, onCommitSelect }) => {
  const { layout, maxColumn } = useMemo(() => {
    const columnMap = new Map<string, number>()
    const columns: (string | null)[] = []
    const layout: { commit: CommitInfo; column: number; color: string; row: number }[] = []
    let maxColumn = 0

    commits.forEach((commit, row) => {
      // Find or assign column for this commit
      let column = columnMap.get(commit.hash)
      
      if (column === undefined) {
        // Find an empty column or create new one
        column = columns.findIndex(c => c === null)
        if (column === -1) {
          column = columns.length
          columns.push(commit.hash)
        } else {
          columns[column] = commit.hash
        }
        columnMap.set(commit.hash, column)
      } else {
        columns[column] = commit.hash
      }

      maxColumn = Math.max(maxColumn, column)

      // Handle parents
      if (commit.parents && commit.parents.length > 0) {
        // First parent continues this column
        const firstParent = commit.parents[0]
        if (!columnMap.has(firstParent)) {
          columnMap.set(firstParent, column)
        }
        
        // Additional parents (merge) get new columns
        for (let i = 1; i < commit.parents.length; i++) {
          if (!columnMap.has(commit.parents[i])) {
            const newCol = columns.findIndex(c => c === null)
            if (newCol === -1) {
              columns.push(commit.parents[i])
              columnMap.set(commit.parents[i], columns.length - 1)
            } else {
              columns[newCol] = commit.parents[i]
              columnMap.set(commit.parents[i], newCol)
            }
          }
        }
      }

      // Free this column if this commit has no children continuing here
      // (simplified: just mark as available for next commits)
      // In a real implementation we'd need to track child relationships
      
      layout.push({
        commit,
        column,
        color: getBranchColor(column),
        row
      })
    })

    return { layout, maxColumn }
  }, [commits])

  const svgWidth = LEFT_PADDING + (maxColumn + 1) * COLUMN_WIDTH + 80
  const svgHeight = commits.length * ROW_HEIGHT + 20

  // Generate paths for connections
  const paths = useMemo(() => {
    const pathElements: React.ReactNode[] = []
    
    layout.forEach((item, index) => {
      const x1 = LEFT_PADDING + item.column * COLUMN_WIDTH + DOT_RADIUS
      const y1 = index * ROW_HEIGHT + ROW_HEIGHT / 2
      
      item.commit.parents.forEach((parentHash) => {
        const parentItem = layout.find(l => l.commit.hash === parentHash)
        if (parentItem) {
          const parentRow = layout.indexOf(parentItem)
          const x2 = LEFT_PADDING + parentItem.column * COLUMN_WIDTH + DOT_RADIUS
          const y2 = parentRow * ROW_HEIGHT + ROW_HEIGHT / 2
          
          // Draw curved line
          const midY = (y1 + y2) / 2
          const color = parentRow === 0 ? item.color : getBranchColor(parentItem.column)
          
          pathElements.push(
            <path
              key={`${item.commit.hash}-${parentHash}`}
              d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
              stroke={color}
              strokeWidth={LINE_STROKE}
              fill="none"
              opacity={0.7}
            />
          )
        }
      })
    })
    
    return pathElements
  }, [layout])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMessage = (message: string) => {
    const firstLine = message.split('\n')[0]
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine
  }

  const parseRefs = (refs: string): { branches: string[], tags: string[], isHead: boolean } => {
    const result = { branches: [] as string[], tags: [] as string[], isHead: false }
    if (!refs) return result
    
    const parts = refs.split(', ')
    parts.forEach(part => {
      part = part.trim()
      if (part === 'HEAD') {
        result.isHead = true
      } else if (part.startsWith('tag: ')) {
        result.tags.push(part.replace('tag: ', ''))
      } else if (part && !part.startsWith('HEAD ->')) {
        result.branches.push(part.replace('origin/', ''))
      }
    })
    return result
  }

  const isHeadCommit = (commit: CommitInfo) => {
    if (!currentBranch) return false
    // Only the commit with "HEAD -> branchName" is the actual HEAD commit
    return commit.refs.includes(`HEAD -> ${currentBranch}`)
  }

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedCommit?.hash || !scrollContainerRef.current) return

    const scroll = () => {
      const container = scrollContainerRef.current
      if (!container) return
      const element = container.querySelector(`#commit-row-${selectedCommit.hash}`) as HTMLElement | null
      if (element) {
        const containerRect = container.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        const relativeTop = elementRect.top - containerRect.top + container.scrollTop
        const containerHeight = container.clientHeight
        const elementHeight = element.clientHeight

        container.scrollTo({
          top: Math.max(0, relativeTop - containerHeight / 2 + elementHeight / 2),
          behavior: 'auto'
        })
      }
    }

    // Wait for React to finish DOM updates before scrolling
    requestAnimationFrame(() => {
      requestAnimationFrame(scroll)
    })
  }, [selectedCommit?.hash, commits.length])

  if (commits.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
          Commit History
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          {loading ? (
            <>
              <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="mt-2 text-sm text-gray-500">Loading commits...</p>
            </>
          ) : (
            <span className="text-gray-400 text-sm">No commits</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
        Commit History
      </div>
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        <div className="relative">
          {/* SVG Graph overlay */}
          <svg
            className="absolute top-0 left-0 pointer-events-none"
            width={svgWidth}
            height={svgHeight}
            style={{ minWidth: svgWidth }}
          >
            {paths}
            {layout.map((item, index) => {
              const head = isHeadCommit(item.commit)
              const selected = selectedCommit?.hash === item.commit.hash
              return (
              <g key={`dot-${item.commit.hash}`}>
                {head && (
                  <circle
                    cx={LEFT_PADDING + item.column * COLUMN_WIDTH + DOT_RADIUS}
                    cy={index * ROW_HEIGHT + ROW_HEIGHT / 2}
                    r={DOT_RADIUS + 4}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                )}
                {selected && (
                  <circle
                    cx={LEFT_PADDING + item.column * COLUMN_WIDTH + DOT_RADIUS}
                    cy={index * ROW_HEIGHT + ROW_HEIGHT / 2}
                    r={DOT_RADIUS + 6}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    opacity={0.8}
                  />
                )}
                <circle
                  cx={LEFT_PADDING + item.column * COLUMN_WIDTH + DOT_RADIUS}
                  cy={index * ROW_HEIGHT + ROW_HEIGHT / 2}
                  r={head ? DOT_RADIUS + 2 : selected ? DOT_RADIUS + 2 : DOT_RADIUS}
                  fill={selected ? '#2563eb' : item.color}
                  stroke="white"
                  strokeWidth={head || selected ? 2 : 1}
                />
                {/* Branch labels */}
                {(() => {
                  const refs = parseRefs(item.commit.refs)
                  if (refs.branches.length === 0 && refs.tags.length === 0 && !refs.isHead) return null
                  
                  const labelX = LEFT_PADDING + (maxColumn + 1) * COLUMN_WIDTH + 8
                  const labelY = index * ROW_HEIGHT + ROW_HEIGHT / 2 + 3
                  
                  return (
                    <g>
                      {refs.branches.map((branch, i) => (
                        <g key={`branch-${branch}`}>
                          <rect
                            x={labelX - 3}
                            y={labelY - 10 + i * 14}
                            width={branch.length * 6 + 6}
                            height={14}
                            rx={2}
                            fill={item.color}
                            opacity={0.15}
                          />
                          <text
                            x={labelX}
                            y={labelY + i * 14}
                            fontSize={9}
                            fill={item.color}
                            fontWeight="bold"
                          >
                            {branch}
                          </text>
                        </g>
                      ))}
                      {refs.tags.map((tag, i) => (
                        <g key={`tag-${tag}`} transform={`translate(0, ${refs.branches.length * 14})`}>
                          <rect
                            x={labelX - 3}
                            y={labelY - 10 + i * 14}
                            width={tag.length * 6 + 6}
                            height={14}
                            rx={2}
                            fill="#f59e0b"
                            opacity={0.15}
                          />
                          <text
                            x={labelX}
                            y={labelY + i * 14}
                            fontSize={9}
                            fill="#f59e0b"
                            fontWeight="bold"
                          >
                            {tag}
                          </text>
                        </g>
                      ))}
                    </g>
                  )
                })()}
              </g>
            )}
            )}
          </svg>

          {/* Commit rows */}
          <div className="relative">
            {layout.map((item) => (
              <button
                key={item.commit.hash}
                id={`commit-row-${item.commit.hash}`}
                data-selected={selectedCommit?.hash === item.commit.hash ? 'true' : undefined}
                onClick={() => onCommitSelect(item.commit)}
                className={`w-full text-left flex items-center hover:bg-gray-100 transition border-b border-gray-50 relative pl-0 ${
                  selectedCommit?.hash === item.commit.hash
                    ? 'bg-blue-100/40 commit-selected'
                    : isHeadCommit(item.commit)
                      ? 'bg-blue-50/30'
                      : ''
                }`}
                style={{ height: ROW_HEIGHT, paddingLeft: svgWidth + 8 }}
              >
                {selectedCommit?.hash === item.commit.hash && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 rounded-r" />
                )}
                <div className="flex-1 min-w-0 pr-4">
                  <div className={`text-sm text-gray-800 truncate ${
                    selectedCommit?.hash === item.commit.hash ? 'font-bold text-blue-900' : 'font-medium'
                  }`}>
                    {formatMessage(item.commit.message)}
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0 mr-4">
                  {isHeadCommit(item.commit) && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                      HEAD
                    </span>
                  )}
                  <span className="text-xs text-gray-500 w-20 text-right truncate">
                    {item.commit.author_name}
                  </span>
                  <span className="text-xs text-gray-400 w-24 text-right">
                    {formatDate(item.commit.date)}
                  </span>
                  <span className="text-xs text-gray-400 font-mono w-16 text-right">
                    {item.commit.hash.substring(0, 7)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommitGraph
