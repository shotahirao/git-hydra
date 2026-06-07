import { CommitInfo, BranchInfo, GitStatus, DiffFile } from '@git-types/git'

export interface RepoTab {
  id: string
  repoPath: string
  name: string // repo directory name
  branches: BranchInfo[]
  commits: CommitInfo[]
  selectedCommit: CommitInfo | null
  status: GitStatus | null
  diff: DiffFile[]
  loading: boolean
  error: string
}
