use chrono::{DateTime, FixedOffset, TimeZone};
use git2::{
    BranchType, Commit, CredentialType, Cred, Diff, DiffOptions, Error as Git2Error, FetchOptions,
    PushOptions, RemoteCallbacks, Repository, StatusOptions, StatusShow, WorktreeAddOptions,
};
use serde::Serialize;
use std::{cell::RefCell, env, path::{Path, PathBuf}, sync::Arc};

#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error("git2 error: {0}")]
    Git2(#[from] Git2Error),
    #[error("repository not open: {0}")]
    RepoNotOpen(String),
    #[error("invalid repository: {0}")]
    InvalidRepo(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("utf8 error: {0}")]
    Utf8(#[from] std::str::Utf8Error),
    #[error("{0}")]
    Message(String),
}

impl Serialize for GitError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type GitResult<T> = Result<T, GitError>;

#[derive(Debug, Clone, Serialize)]
pub struct RepoInfo {
    pub path: String,
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ahead: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub behind: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub date: String,
    pub parents: Vec<String>,
    pub refs: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_merge: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub current: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote: Option<String>,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileStatus {
    pub path: String,
    pub index: String,
    pub working_dir: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitStatus {
    pub current: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tracking: Option<String>,
    pub ahead: i32,
    pub behind: i32,
    pub staged: Vec<FileStatus>,
    pub modified: Vec<FileStatus>,
    pub untracked: Vec<FileStatus>,
    pub conflicted: Vec<FileStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffLine {
    pub r#type: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_line_number: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_line_number: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffHunk {
    pub old_start: i32,
    pub old_lines: i32,
    pub new_start: i32,
    pub new_lines: i32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DiffFile {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_path: Option<String>,
    pub status: String,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorktreeInfo {
    pub name: String,
    pub path: String,
}

pub struct GitService;

impl GitService {
    pub fn new() -> Self {
        Self
    }

    fn get_repo(&self, repo_path: &str) -> GitResult<Repository> {
        Repository::open(repo_path).map_err(|e| {
            if e.code() == git2::ErrorCode::NotFound {
                GitError::RepoNotOpen(repo_path.to_string())
            } else {
                GitError::Git2(e)
            }
        })
    }

    pub fn is_valid_repo(&self, repo_path: &str) -> GitResult<bool> {
        match Repository::open(repo_path) {
            Ok(repo) => {
                let git_dir = repo.path();
                Ok(git_dir.exists())
            }
            Err(_) => Ok(false),
        }
    }

    pub fn open_repo(&self, repo_path: &str) -> GitResult<RepoInfo> {
        let repo = Repository::open(repo_path)?;
        let status = self.repo_status_summary(&repo)?;
        Ok(RepoInfo {
            path: repo_path.to_string(),
            valid: true,
            current_branch: Some(status.current),
            ahead: Some(status.ahead),
            behind: Some(status.behind),
        })
    }

    pub fn close_repo(&self, _repo_path: &str) {
        // No-op: repositories are opened on demand per operation.
    }

    fn repo_status_summary(&self, repo: &Repository) -> GitResult<GitStatus> {
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(true)
            .renames_index_to_workdir(true)
            .renames_head_to_index(true)
            .show(StatusShow::IndexAndWorkdir);

        let statuses = repo.statuses(Some(&mut opts))?;
        let mut staged = Vec::new();
        let mut modified = Vec::new();
        let mut untracked = Vec::new();
        let mut conflicted = Vec::new();

        for entry in statuses.iter() {
            let path = entry.path().unwrap_or("?").to_string();
            let status = entry.status();
            let index_code = status_to_index_code(status);
            let wt_code = status_to_wt_code(status);
            let file_status = FileStatus {
                path: path.clone(),
                index: index_code.clone(),
                working_dir: wt_code.clone(),
                status: determine_status(&index_code, &wt_code),
            };

            if status.is_conflicted() {
                conflicted.push(file_status.clone());
            }
            if is_index_changed(status) {
                staged.push(file_status.clone());
            }
            if is_worktree_changed(status) && !status.is_wt_new() {
                modified.push(file_status.clone());
            }
            if status.is_wt_new() {
                untracked.push(file_status);
            }
        }

        let head = repo.head().ok();
        let current = head
            .as_ref()
            .and_then(|h| h.shorthand().map(String::from))
            .unwrap_or_default();
        let upstream_name = head
            .as_ref()
            .and_then(|h| h.resolve().ok())
            .and_then(|h| h.shorthand().map(String::from));

        let (ahead, behind) = if let Some(head_ref) = head {
            if let Ok(upstream) = repo.resolve_reference_from_short_name(
                upstream_name.as_deref().unwrap_or("@{upstream}"),
            ) {
                if let (Some(local), Some(upstream_oid)) =
                    (head_ref.target(), upstream.target())
                {
                    let graph = repo.graph_ahead_behind(local, upstream_oid)?;
                    (graph.0 as i32, graph.1 as i32)
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        } else {
            (0, 0)
        };

        Ok(GitStatus {
            current,
            tracking: upstream_name,
            ahead,
            behind,
            staged,
            modified,
            untracked,
            conflicted,
        })
    }

    pub fn get_status(&self, repo_path: &str) -> GitResult<GitStatus> {
        let repo = self.get_repo(repo_path)?;
        self.repo_status_summary(&repo)
    }

    pub fn get_branches(&self, repo_path: &str) -> GitResult<Vec<BranchInfo>> {
        let repo = self.get_repo(repo_path)?;
        let branches = repo.branches(Some(BranchType::Local))?;
        let mut result = Vec::new();
        for branch_result in branches {
            let (branch, _) = branch_result?;
            let name = branch.name()?.unwrap_or("?").to_string();
            let is_head = branch.is_head();
            result.push(BranchInfo {
                name: name.clone(),
                current: is_head,
                remote: None,
                label: name,
            });
        }

        let remote_branches = repo.branches(Some(BranchType::Remote))?;
        for branch_result in remote_branches {
            let (branch, _) = branch_result?;
            let name = branch.name()?.unwrap_or("?").to_string();
            let remote = name.split_once('/').map(|(remote, _)| remote.to_string());
            let label = name.clone();
            result.push(BranchInfo {
                name,
                current: false,
                remote,
                label,
            });
        }

        Ok(result)
    }

    pub fn get_log(
        &self,
        repo_path: &str,
        max_count: usize,
        skip: usize,
    ) -> GitResult<Vec<CommitInfo>> {
        let repo = self.get_repo(repo_path)?;
        let mut revwalk = repo.revwalk()?;
        revwalk.push_head()?;
        revwalk.set_sorting(git2::Sort::TIME)?;

        let mut commits = Vec::new();
        for (idx, oid) in revwalk.enumerate() {
            if idx < skip {
                continue;
            }
            if commits.len() >= max_count {
                break;
            }
            let oid = oid?;
            let commit = repo.find_commit(oid)?;
            commits.push(commit_to_info(&commit, &repo)?);
        }

        Ok(commits)
    }

    pub fn get_diff(
        &self,
        repo_path: &str,
        commit_hash: Option<&str>,
        file_path: Option<&str>,
    ) -> GitResult<Vec<DiffFile>> {
        let repo = self.get_repo(repo_path)?;
        let diff = if let Some(hash) = commit_hash {
            let commit = repo.find_commit(repo.revparse_single(hash)?.id())?;
            let tree = commit.tree()?;
            let parent_tree = if commit.parent_count() > 0 {
                Some(commit.parent(0)?.tree()?)
            } else {
                None
            };
            let mut opts = DiffOptions::new();
            apply_pathspec(&mut opts, file_path);
            repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&tree), Some(&mut opts))?
        } else {
            let mut opts = DiffOptions::new();
            apply_pathspec(&mut opts, file_path);
            repo.diff_index_to_workdir(None, Some(&mut opts))?
        };
        diff_to_files(&diff)
    }

    pub fn get_working_diff(
        &self,
        repo_path: &str,
        file_path: Option<&str>,
    ) -> GitResult<Vec<DiffFile>> {
        let repo = self.get_repo(repo_path)?;
        let mut opts = DiffOptions::new();
        apply_pathspec(&mut opts, file_path);
        let diff = repo.diff_index_to_workdir(None, Some(&mut opts))?;
        diff_to_files(&diff)
    }

    pub fn get_staged_diff(
        &self,
        repo_path: &str,
        file_path: Option<&str>,
    ) -> GitResult<Vec<DiffFile>> {
        let repo = self.get_repo(repo_path)?;
        let head = repo.head()?.peel_to_tree()?;
        let mut opts = DiffOptions::new();
        apply_pathspec(&mut opts, file_path);
        let diff = repo.diff_tree_to_index(Some(&head), None, Some(&mut opts))?;
        diff_to_files(&diff)
    }

    pub fn get_commit_diff(
        &self,
        repo_path: &str,
        commit_hash: &str,
    ) -> GitResult<Vec<DiffFile>> {
        self.get_diff(repo_path, Some(commit_hash), None)
    }

    pub fn stage(&self, repo_path: &str, file_paths: &[String]) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        let mut index = repo.index()?;
        for path in file_paths {
            index.add_path(Path::new(path))?;
        }
        index.write()?;
        Ok(())
    }

    pub fn unstage(&self, repo_path: &str, file_paths: &[String]) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        let head = repo.head()?.peel_to_commit()?;
        let paths: Vec<&Path> = file_paths.iter().map(|p| Path::new(p)).collect();
        repo.reset_default(Some(&head.into_object()), paths.into_iter())?;
        Ok(())
    }

    pub fn commit(&self, repo_path: &str, message: &str) -> GitResult<String> {
        let repo = self.get_repo(repo_path)?;
        let mut index = repo.index()?;
        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        let sig = repo.signature()?;
        let parent = repo.head()?.peel_to_commit()?;

        let oid = repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            message,
            &tree,
            &[&parent],
        )?;
        Ok(oid.to_string())
    }

    pub fn checkout(
        &self,
        repo_path: &str,
        target: &str,
        create_branch: bool,
    ) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;

        if create_branch {
            let head = repo.head()?.peel_to_commit()?;
            repo.branch(target, &head, false)?;
            let obj = repo.revparse_single(target)?;
            repo.checkout_tree(&obj, Some(git2::build::CheckoutBuilder::new().force()))?;
            repo.set_head(&format!("refs/heads/{target}"))?;
        } else {
            let obj = repo.revparse_single(target)?;
            repo.checkout_tree(&obj, Some(git2::build::CheckoutBuilder::new().force()))?;
            if repo.find_branch(target, BranchType::Local).is_ok() {
                repo.set_head(&format!("refs/heads/{target}"))?;
            } else {
                repo.set_head_detached(obj.id())?;
            }
        }
        Ok(())
    }

    pub fn create_branch(
        &self,
        repo_path: &str,
        branch_name: &str,
        from: Option<&str>,
    ) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let target = from.unwrap_or("HEAD");
        let commit = repo.revparse_single(target)?.peel_to_commit()?;
        repo.branch(branch_name, &commit, false)?;
        Ok(())
    }

    pub fn delete_branch(
        &self,
        repo_path: &str,
        branch_name: &str,
        force: bool,
    ) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let mut branch = repo.find_branch(branch_name, BranchType::Local)?;
        if !force {
            let head = repo.head()?.peel_to_commit()?;
            let branch_commit = branch.get().peel_to_commit()?;
            let merged = head.id() == branch_commit.id()
                || repo.graph_descendant_of(head.id(), branch_commit.id())?;
            if !merged {
                return Err(GitError::Message(format!(
                    "The branch '{branch_name}' is not fully merged."
                )));
            }
        }
        branch.delete()?;
        Ok(())
    }

    pub fn rename_branch(
        &self,
        repo_path: &str,
        old_name: &str,
        new_name: &str,
    ) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let mut branch = repo.find_branch(old_name, BranchType::Local)?;
        branch.rename(new_name, true)?;
        Ok(())
    }

    pub fn merge(&self, repo_path: &str, branch_name: &str) -> GitResult<String> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let their_oid = repo.revparse_single(branch_name)?.id();
        let their_annotated = repo.find_annotated_commit(their_oid)?;
        let their_commit = repo.find_commit(their_oid)?;
        let mut merge_opts = git2::MergeOptions::new();
        repo.merge(&[&their_annotated], Some(&mut merge_opts), None)?;

        let mut index = repo.index()?;
        if index.has_conflicts() {
            return Err(GitError::Message(format!(
                "Merge conflict occurred when merging {branch_name}. Please resolve conflicts manually."
            )));
        }

        let tree_oid = index.write_tree()?;
        let tree = repo.find_tree(tree_oid)?;
        let head = repo.head()?.peel_to_commit()?;
        let sig = repo.signature()?;
        let msg = format!("Merge branch '{branch_name}'");
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            &msg,
            &tree,
            &[&head, &their_commit],
        )?;
        repo.cleanup_state()?;
        Ok(format!("Merged {branch_name}"))
    }

    pub fn rebase(&self, repo_path: &str, branch_name: &str) -> GitResult<String> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let upstream_oid = repo.revparse_single(branch_name)?.id();
        let upstream = repo.find_annotated_commit(upstream_oid)?;
        let branch_oid = repo.head()?.target().ok_or_else(|| {
            GitError::Message("HEAD does not point to a commit".to_string())
        })?;
        let branch_annotated = repo.find_annotated_commit(branch_oid)?;
        let mut rebase = repo.rebase(
            Some(&branch_annotated),
            Some(&upstream),
            None,
            Some(&mut git2::RebaseOptions::new()),
        )?;

        while let Some(op) = rebase.next() {
            let _op = op?;
            if repo.index()?.has_conflicts() {
                rebase.abort()?;
                return Err(GitError::Message(format!(
                    "Rebase failed: conflict occurred"
                )));
            }
            let sig = repo.signature()?;
            rebase.commit(None, &sig, Some("rebased commit"))?;
        }
        rebase.finish(None)?;
        Ok(format!("Rebased onto {branch_name}"))
    }

    pub fn push(
        &self,
        repo_path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
    ) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let remote_name = remote.unwrap_or("origin");
        let mut remote = repo.find_remote(remote_name)?;
        let local_branch = branch
            .map(String::from)
            .or_else(|| {
                repo.head()
                    .ok()
                    .and_then(|h| h.shorthand().map(String::from))
            })
            .unwrap_or_else(|| "HEAD".to_string());
        let refspec = format!("refs/heads/{local_branch}:refs/heads/{local_branch}");
        let mut push_opts = PushOptions::new();
        push_opts.remote_callbacks(make_remote_callbacks());
        remote.push(&[refspec], Some(&mut push_opts))?;
        Ok(())
    }

    pub fn pull(
        &self,
        repo_path: &str,
        remote: Option<&str>,
        branch: Option<&str>,
    ) -> GitResult<String> {
        self.fetch(repo_path, remote)?;
        let upstream_branch = format!(
            "{}/{}",
            remote.unwrap_or("origin"),
            branch.unwrap_or("HEAD")
        );
        self.merge(repo_path, &upstream_branch)
    }

    pub fn fetch(&self, repo_path: &str, remote: Option<&str>) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let remote_name = remote.unwrap_or("origin");
        let mut remote = repo.find_remote(remote_name)?;
        let mut fetch_opts = FetchOptions::new();
        fetch_opts.remote_callbacks(make_remote_callbacks());
        remote.fetch(&[] as &[&str], Some(&mut fetch_opts), None)?;
        Ok(())
    }

    pub fn list_worktrees(&self, repo_path: &str) -> GitResult<Vec<WorktreeInfo>> {
        let repo = self.get_repo(repo_path)?;
        let names = repo.worktrees()?;
        let mut result = Vec::new();
        for name in names.iter() {
            if let Some(name) = name {
                let wt = repo.find_worktree(name)?;
                result.push(WorktreeInfo {
                    name: name.to_string(),
                    path: wt.path().to_string_lossy().to_string(),
                });
            }
        }
        Ok(result)
    }

    pub fn add_worktree(
        &self,
        repo_path: &str,
        name: &str,
        path: &str,
        reference: Option<&str>,
    ) -> GitResult<WorktreeInfo> {
        let repo = self.get_repo(repo_path)?;
        self.ensure_no_lock(&repo)?;
        let mut opts = WorktreeAddOptions::new();
        let resolved_reference = if let Some(reference) = reference {
            Some(repo.resolve_reference_from_short_name(reference)?)
        } else {
            None
        };
        if let Some(ref reference) = resolved_reference {
            opts.reference(Some(reference));
        }
        let wt = repo.worktree(name, Path::new(path), Some(&mut opts))?;
        Ok(WorktreeInfo {
            name: name.to_string(),
            path: wt.path().to_string_lossy().to_string(),
        })
    }

    pub fn remove_worktree(&self, repo_path: &str, name: &str) -> GitResult<()> {
        let repo = self.get_repo(repo_path)?;
        let wt = repo.find_worktree(name)?;
        wt.prune(None)?;
        Ok(())
    }

    fn ensure_no_lock(&self, repo: &Repository) -> GitResult<()> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| GitError::Message("No working directory".to_string()))?;
        let lock_file = workdir.join(".git").join("index.lock");
        if lock_file.exists() {
            match std::fs::remove_file(&lock_file) {
                Ok(_) => Ok(()),
                Err(_) => Err(GitError::Message(
                    "Git repository is locked by another process. Please close other Git applications and try again."
                        .to_string(),
                )),
            }
        } else {
            Ok(())
        }
    }
}

fn make_remote_callbacks<'a>() -> RemoteCallbacks<'a> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(|url, username, allowed| {
        if allowed.contains(CredentialType::SSH_KEY) {
            if let Ok(cred) = Cred::ssh_key_from_agent(username.unwrap_or("git")) {
                return Ok(cred);
            }
            let home = env::var("HOME").unwrap_or_default();
            for key in ["id_rsa", "id_ed25519", "id_ecdsa"] {
                let path = PathBuf::from(&home).join(".ssh").join(key);
                if path.exists() {
                    return Cred::ssh_key(username.unwrap_or("git"), None, &path, None);
                }
            }
        }
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(cfg) = git2::Config::open_default() {
                return Cred::credential_helper(&cfg, url, username);
            }
        }
        Err(Git2Error::from_str("no credentials available"))
    });
    cb
}

fn commit_to_info(commit: &Commit, repo: &Repository) -> GitResult<CommitInfo> {
    let author = commit.author();
    let time = author.when();
    let offset = FixedOffset::east_opt(time.offset_minutes() * 60)
        .unwrap_or_else(|| FixedOffset::east_opt(0).unwrap());
    let dt: DateTime<FixedOffset> = offset
        .timestamp_opt(time.seconds(), 0)
        .single()
        .unwrap_or_else(|| {
            FixedOffset::east_opt(0)
                .unwrap()
                .timestamp_opt(time.seconds(), 0)
                .single()
                .unwrap()
        });

    let mut refs = String::new();
    if let Ok(head) = repo.head() {
        if head.target() == Some(commit.id()) {
            refs.push_str("HEAD");
        }
    }

    Ok(CommitInfo {
        hash: commit.id().to_string(),
        message: commit.message().unwrap_or("").to_string(),
        author_name: author.name().unwrap_or("").to_string(),
        author_email: author.email().unwrap_or("").to_string(),
        date: dt.to_rfc3339(),
        parents: commit
            .parent_ids()
            .map(|id| id.to_string())
            .collect(),
        refs,
        branch: None,
        column: None,
        is_merge: Some(commit.parent_count() > 1),
    })
}

fn status_to_index_code(status: git2::Status) -> String {
    if status.is_index_new() {
        "A".to_string()
    } else if status.is_index_modified() {
        "M".to_string()
    } else if status.is_index_deleted() {
        "D".to_string()
    } else if status.is_index_renamed() {
        "R".to_string()
    } else if status.is_index_typechange() {
        "T".to_string()
    } else {
        " ".to_string()
    }
}

fn status_to_wt_code(status: git2::Status) -> String {
    if status.is_wt_new() {
        "?".to_string()
    } else if status.is_wt_modified() {
        "M".to_string()
    } else if status.is_wt_deleted() {
        "D".to_string()
    } else if status.is_wt_renamed() {
        "R".to_string()
    } else if status.is_wt_typechange() {
        "T".to_string()
    } else {
        " ".to_string()
    }
}

fn is_index_changed(status: git2::Status) -> bool {
    status.is_index_new()
        || status.is_index_modified()
        || status.is_index_deleted()
        || status.is_index_renamed()
        || status.is_index_typechange()
}

fn is_worktree_changed(status: git2::Status) -> bool {
    status.is_wt_modified()
        || status.is_wt_deleted()
        || status.is_wt_renamed()
        || status.is_wt_typechange()
}

fn determine_status(index: &str, working_dir: &str) -> String {
    let code = if index != " " { index } else { working_dir };
    match code {
        "M" => "modified",
        "A" => "added",
        "D" => "deleted",
        "R" => "renamed",
        "C" => "copied",
        "?" => "untracked",
        "!" => "ignored",
        "U" => "conflicted",
        _ => "modified",
    }
    .to_string()
}

fn apply_pathspec(opts: &mut DiffOptions, file_path: Option<&str>) {
    if let Some(path) = file_path {
        opts.pathspec(path);
    }
}

fn diff_to_files(diff: &Diff) -> GitResult<Vec<DiffFile>> {
    let files: RefCell<Vec<DiffFile>> = RefCell::new(Vec::new());
    let current_file: RefCell<Option<DiffFile>> = RefCell::new(None);
    let current_hunk: RefCell<Option<DiffHunk>> = RefCell::new(None);

    diff.foreach(
        &mut |delta, _progress| {
            let mut cf = current_file.borrow_mut();
            if let Some(mut f) = cf.take() {
                let mut ch = current_hunk.borrow_mut();
                if let Some(h) = ch.take() {
                    f.hunks.push(h);
                }
                files.borrow_mut().push(f);
            }

            let new_path = delta
                .new_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            let old_path = delta
                .old_file()
                .path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                git2::Delta::Copied => "copied",
                _ => "modified",
            };

            *cf = Some(DiffFile {
                path: new_path.clone(),
                old_path: if old_path != new_path {
                    Some(old_path)
                } else {
                    None
                },
                status: status.to_string(),
                hunks: Vec::new(),
            });
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            let mut cf = current_file.borrow_mut();
            let mut ch = current_hunk.borrow_mut();
            if let Some(ref mut f) = *cf {
                if let Some(h) = ch.take() {
                    f.hunks.push(h);
                }
                *ch = Some(DiffHunk {
                    old_start: hunk.old_start() as i32,
                    old_lines: hunk.old_lines() as i32,
                    new_start: hunk.new_start() as i32,
                    new_lines: hunk.new_lines() as i32,
                    lines: vec![DiffLine {
                        r#type: "header".to_string(),
                        content: String::from_utf8_lossy(hunk.header())
                            .trim_end_matches('\n')
                            .to_string(),
                        old_line_number: None,
                        new_line_number: None,
                    }],
                });
            }
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let mut ch = current_hunk.borrow_mut();
            if let Some(ref mut h) = *ch {
                let line_type = match line.origin() {
                    '+' | '>' => "add",
                    '-' | '<' => "del",
                    ' ' | '=' => "normal",
                    _ => "normal",
                };
                let content = String::from_utf8_lossy(line.content())
                    .trim_end_matches('\n')
                    .to_string();
                h.lines.push(DiffLine {
                    r#type: line_type.to_string(),
                    content,
                    old_line_number: None,
                    new_line_number: None,
                });
            }
            true
        }),
    )?;

    let mut cf = current_file.borrow_mut();
    if let Some(mut f) = cf.take() {
        let mut ch = current_hunk.borrow_mut();
        if let Some(h) = ch.take() {
            f.hunks.push(h);
        }
        files.borrow_mut().push(f);
    }

    Ok(files.into_inner())
}

lazy_static::lazy_static! {
    static ref SERVICE: Arc<GitService> = Arc::new(GitService::new());
}

pub fn git_service() -> Arc<GitService> {
    SERVICE.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Signature;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_repo() -> (TempDir, String) {
        let dir = TempDir::new().unwrap();
        let path = dir.path().to_string_lossy().to_string();
        let repo = Repository::init(&path).unwrap();

        let sig = Signature::now("Test", "test@example.com").unwrap();

        // First commit
        fs::write(dir.path().join("file1.txt"), "hello world\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file1.txt")).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Initial commit",
            &tree,
            &[],
        )
        .unwrap();

        // Second commit with modification
        fs::write(dir.path().join("file1.txt"), "hello world\nnew line\n").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file1.txt")).unwrap();
        index.write().unwrap();
        let tree_oid = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_oid).unwrap();
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(
            Some("HEAD"),
            &sig,
            &sig,
            "Add line",
            &tree,
            &[&parent],
        )
        .unwrap();

        (dir, path)
    }

    #[test]
    fn test_get_commit_diff() {
        let (_dir, path) = create_test_repo();
        let service = GitService::new();
        let files = service.get_commit_diff(&path, "HEAD").unwrap();
        println!("files: {:?}", files);
        assert!(!files.is_empty(), "diff should not be empty");
        assert!(!files[0].hunks.is_empty(), "hunks should not be empty");
        assert!(
            files[0].hunks[0].lines.iter().any(|l| l.r#type == "add"),
            "should have an added line"
        );
    }

    #[test]
    fn test_get_working_diff() {
        let (dir, path) = create_test_repo();
        fs::write(dir.path().join("file1.txt"), "hello world\nnew line\nanother line\n").unwrap();
        let service = GitService::new();
        let files = service.get_working_diff(&path, None).unwrap();
        println!("working diff files: {:?}", files);
        assert!(!files.is_empty(), "working diff should not be empty");
        assert!(
            files[0].hunks[0].lines.iter().any(|l| l.r#type == "add"),
            "should have an added line"
        );
    }

    #[test]
    fn test_get_staged_diff() {
        let (dir, path) = create_test_repo();
        fs::write(dir.path().join("file1.txt"), "hello world\nnew line\nanother line\n").unwrap();
        let repo = Repository::open(&path).unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file1.txt")).unwrap();
        index.write().unwrap();

        let service = GitService::new();
        let files = service.get_staged_diff(&path, None).unwrap();
        println!("staged diff files: {:?}", files);
        assert!(!files.is_empty(), "staged diff should not be empty");
        assert!(
            files[0].hunks[0].lines.iter().any(|l| l.r#type == "add"),
            "should have an added line"
        );
    }
}
