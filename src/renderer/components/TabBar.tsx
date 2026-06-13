import React from 'react'

export interface TabInfo {
  id: string
  name: string
  repoPath: string
}

interface TabBarProps {
  tabs: TabInfo[]
  activeTabId: string | null
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
  onNewTab: () => void
}

const TabBar: React.FC<TabBarProps> = ({ tabs, activeTabId, onTabClick, onTabClose, onNewTab }) => {
  const isMac = window.electronAPI?.platform === 'darwin'
  return (
    <div className="flex items-center h-10 bg-gray-800 border-b border-gray-700 select-none">
      <div className={`flex flex-1 overflow-x-auto ${isMac ? 'pl-20' : ''}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              className={`
                group flex items-center min-w-[140px] max-w-[240px] h-10 px-3 cursor-pointer
                border-r border-gray-700 text-sm transition-colors
                ${isActive ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-gray-200'}
              `}
            >
              <span className="truncate flex-1 mr-2">{tab.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
                className={`
                  w-4 h-4 flex items-center justify-center rounded text-xs
                  ${isActive ? 'hover:bg-gray-600 text-gray-300' : 'hover:bg-gray-700 text-gray-500 group-hover:text-gray-300'}
                `}
                title="Close tab"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={onNewTab}
        className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-lg"
        title="New tab"
      >
        +
      </button>
    </div>
  )
}

export default TabBar
