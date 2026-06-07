export interface CommitInfo {
  hash: string
  message: string
  author_name: string
  author_email: string
  date: string
  parents: string[]
  refs: string
  branch?: string
  // Graph layout info
  column?: number
  isMerge?: boolean
}

export interface BranchInfo {
  name: string
  current: boolean
  remote?: string
  label: string
}

export interface FileStatus {
  path: string
  index: string  // staged status
  working_dir: string  // unstaged status
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'ignored' | 'conflicted' | 'staged'
}

export interface DiffLine {
  type: 'add' | 'del' | 'normal' | 'header'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffFile {
  path: string
  oldPath?: string
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied'
  hunks: DiffHunk[]
}

export interface RepoInfo {
  path: string
  valid: boolean
  currentBranch?: string
  ahead?: number
  behind?: number
}

export interface GitStatus {
  current: string
  tracking?: string
  ahead: number
  behind: number
  staged: FileStatus[]
  modified: FileStatus[]
  untracked: FileStatus[]
  conflicted: FileStatus[]
}
