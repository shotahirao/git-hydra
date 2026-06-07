import React, { useState, useRef, useEffect } from 'react'
import { BranchInfo } from '@git-types/git'

interface BranchListProps {
  branches: BranchInfo[]
  currentBranch?: string
  loading: boolean
  onCheckout: (branchName: string) => void
  onCreateBranch: (branchName: string) => void
  onMerge?: (branchName: string) => void
  onRebase?: (branchName: string) => void
  onDeleteBranch?: (branchName: string, force: boolean) => void
  onRenameBranch?: (oldName: string, newName: string) => void
}

const BranchList: React.FC<BranchListProps> = ({
  branches,
  currentBranch,
  loading,
  onCheckout,
  onCreateBranch,
  onMerge,
  onRebase,
  onDeleteBranch,
  onRenameBranch
}) => {
  const [newBranchName, setNewBranchName] = useState('')
  const [showNewBranch, setShowNewBranch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    branch: BranchInfo | null
  }>({ visible: false, x: 0, y: 0, branch: null })
  const [renameDialog, setRenameDialog] = useState<{
    visible: boolean
    branch: BranchInfo | null
    newName: string
  }>({ visible: false, branch: null, newName: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<{
    visible: boolean
    branch: BranchInfo | null
    force: boolean
  }>({ visible: false, branch: null, force: false })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  const filterBranches = (branchList: BranchInfo[]) => {
    if (!searchQuery.trim()) return branchList
    const query = searchQuery.toLowerCase().trim()
    return branchList.filter(b => b.name.toLowerCase().includes(query) || b.label.toLowerCase().includes(query))
  }

  const localBranches = filterBranches(branches.filter(b => !b.name.startsWith('remotes/')))
  const remoteBranches = filterBranches(branches.filter(b => b.name.startsWith('remotes/')))

  const handleContextMenu = (e: React.MouseEvent, branch: BranchInfo) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      branch
    })
  }

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, branch: null })
  }

  const handleMerge = () => {
    if (contextMenu.branch && onMerge) {
      onMerge(contextMenu.branch.name)
    }
    closeContextMenu()
  }

  const handleRebase = () => {
    if (contextMenu.branch && onRebase) {
      onRebase(contextMenu.branch.name)
    }
    closeContextMenu()
  }

  const handleDeleteClick = (force: boolean = false) => {
    if (contextMenu.branch) {
      setDeleteConfirm({ visible: true, branch: contextMenu.branch, force })
    }
    closeContextMenu()
  }

  const handleDeleteConfirm = () => {
    if (deleteConfirm.branch && onDeleteBranch) {
      onDeleteBranch(deleteConfirm.branch.name, deleteConfirm.force)
    }
    setDeleteConfirm({ visible: false, branch: null, force: false })
  }

  const handleRenameClick = () => {
    if (contextMenu.branch) {
      setRenameDialog({ visible: true, branch: contextMenu.branch, newName: contextMenu.branch.name })
    }
    closeContextMenu()
  }

  const handleRenameConfirm = () => {
    if (renameDialog.branch && renameDialog.newName.trim() && onRenameBranch) {
      onRenameBranch(renameDialog.branch.name, renameDialog.newName.trim())
    }
    setRenameDialog({ visible: false, branch: null, newName: '' })
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        closeContextMenu()
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const isCurrentBranch = (branch: BranchInfo) => branch.name === currentBranch || branch.current

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 font-semibold text-sm text-gray-700">
        Branches
      </div>
      
      {/* Search Box */}
      <div className="px-2 py-2 border-b border-gray-200">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter branches..."
            className="w-full px-3 py-1.5 pl-8 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-2 text-sm text-gray-500">Loading branches...</p>
          </div>
        ) : (
          <>
            {/* Local Branches */}
            <div className="px-2 py-1 text-xs text-gray-500 font-medium uppercase tracking-wider">
              Local ({localBranches.length})
            </div>
            {localBranches.length === 0 && searchQuery && (
              <div className="px-3 py-2 text-xs text-gray-400">No matching local branches</div>
            )}
            {localBranches.map((branch) => (
          <button
            key={branch.name}
            onClick={() => onCheckout(branch.name)}
            onContextMenu={(e) => handleContextMenu(e, branch)}
            className={`w-full text-left pl-2 pr-3 py-1.5 text-sm hover:bg-blue-50 transition flex items-center relative ${
              isCurrentBranch(branch)
                ? 'text-blue-700 font-bold bg-blue-50'
                : 'text-gray-700'
            }`}
          >
            {isCurrentBranch(branch) && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
            )}
            <span className={`mr-2 text-xs ${isCurrentBranch(branch) ? 'text-blue-600' : 'text-gray-400'}`}>
              {isCurrentBranch(branch) ? '●' : '○'}
            </span>
            <span className="truncate">{branch.name}</span>
            {isCurrentBranch(branch) && (
              <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold">
                HEAD
              </span>
            )}
          </button>
        ))}

        {/* Remote Branches */}
        {(remoteBranches.length > 0 || searchQuery) && (
          <>
            <div className="px-2 py-1 mt-2 text-xs text-gray-500 font-medium uppercase tracking-wider">
              Remote ({remoteBranches.length})
            </div>
            {remoteBranches.length === 0 && searchQuery && (
              <div className="px-3 py-2 text-xs text-gray-400">No matching remote branches</div>
            )}
            {remoteBranches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => onCheckout(branch.name)}
                onContextMenu={(e) => handleContextMenu(e, branch)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition text-gray-600 flex items-center"
              >
                <span className="mr-2 text-xs">○</span>
                <span className="truncate">{branch.label}</span>
              </button>
            ))}
          </>
        )}
          </>
        )}
      </div>

      {/* New Branch */}
      <div className="p-2 border-t border-gray-200 bg-gray-50">
        {!showNewBranch ? (
          <button
            onClick={() => setShowNewBranch(true)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 transition text-gray-700"
          >
            + New Branch
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="Branch name"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex space-x-1">
              <button
                onClick={() => {
                  if (newBranchName.trim()) {
                    onCreateBranch(newBranchName.trim())
                    setNewBranchName('')
                    setShowNewBranch(false)
                  }
                }}
                className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowNewBranch(false)
                  setNewBranchName('')
                }}
                className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.branch && (
        <div
          ref={contextMenuRef}
          className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">
            {contextMenu.branch.name}
          </div>
          
          {!isCurrentBranch(contextMenu.branch) && (
            <>
              <button
                onClick={() => {
                  onCheckout(contextMenu.branch!.name)
                  closeContextMenu()
                }}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition text-gray-700"
              >
                Checkout
              </button>
              
              {onMerge && (
                <button
                  onClick={handleMerge}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition text-gray-700"
                >
                  Merge into current branch
                </button>
              )}
              
              {onRebase && (
                <button
                  onClick={handleRebase}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition text-gray-700"
                >
                  Rebase current branch onto this
                </button>
              )}
              
              <div className="border-t border-gray-100 my-1"></div>
            </>
          )}
          
          {onRenameBranch && !contextMenu.branch.name.startsWith('remotes/') && (
            <button
              onClick={handleRenameClick}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition text-gray-700"
            >
              Rename
            </button>
          )}
          
          {onDeleteBranch && !contextMenu.branch.name.startsWith('remotes/') && !isCurrentBranch(contextMenu.branch) && (
            <>
              <button
                onClick={() => handleDeleteClick(false)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition text-red-600"
              >
                Delete
              </button>
              <button
                onClick={() => handleDeleteClick(true)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition text-red-600"
              >
                Force Delete
              </button>
            </>
          )}
        </div>
      )}

      {/* Rename Dialog */}
      {renameDialog.visible && renameDialog.branch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-80">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Rename Branch</h3>
            <p className="text-xs text-gray-500 mb-3">Renaming: {renameDialog.branch.name}</p>
            <input
              type="text"
              value={renameDialog.newName}
              onChange={(e) => setRenameDialog({ ...renameDialog, newName: e.target.value })}
              placeholder="New branch name"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mb-3"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={handleRenameConfirm}
                className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Rename
              </button>
              <button
                onClick={() => setRenameDialog({ visible: false, branch: null, newName: '' })}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirm.visible && deleteConfirm.branch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-4 w-80">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              {deleteConfirm.force ? 'Force Delete Branch' : 'Delete Branch'}
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Are you sure you want to delete <span className="font-mono font-medium">{deleteConfirm.branch.name}</span>?
              {deleteConfirm.force && (
                <span className="text-red-600 block mt-1">This will force delete the branch even if it has unmerged changes!</span>
              )}
            </p>
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteConfirm}
                className={`flex-1 px-3 py-1.5 text-sm text-white rounded transition ${
                  deleteConfirm.force ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm({ visible: false, branch: null, force: false })}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BranchList
