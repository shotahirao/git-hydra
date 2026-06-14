use crate::git_service::{
    git_service, BranchInfo, CommitInfo, DiffFile, GitStatus, RepoInfo, WorktreeInfo,
};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn platform() -> String {
    match std::env::consts::OS {
        "macos" => "darwin".to_string(),
        other => other.to_string(),
    }
}

#[tauri::command]
pub async fn get_recent_repos(app: AppHandle) -> Result<Vec<String>, String> {
    read_json_config(&app, "recent-repos.json", Vec::new())
}

#[tauri::command]
pub async fn add_recent_repo(app: AppHandle, repo_path: String) -> Result<(), String> {
    let mut repos: Vec<String> = read_json_config(&app, "recent-repos.json", Vec::new())?;
    repos.retain(|r| r != &repo_path);
    repos.insert(0, repo_path);
    repos.truncate(10);
    write_json_config(&app, "recent-repos.json", &repos)
}

#[tauri::command]
pub async fn remove_recent_repo(app: AppHandle, repo_path: String) -> Result<(), String> {
    let mut repos: Vec<String> = read_json_config(&app, "recent-repos.json", Vec::new())?;
    repos.retain(|r| r != &repo_path);
    write_json_config(&app, "recent-repos.json", &repos)
}

#[tauri::command]
pub async fn get_session_tabs(app: AppHandle) -> Result<Vec<String>, String> {
    read_json_config(&app, "session-tabs.json", Vec::new())
}

#[tauri::command]
pub async fn save_session_tabs(
    app: AppHandle,
    tab_paths: Vec<String>,
) -> Result<(), String> {
    write_json_config(&app, "session-tabs.json", &tab_paths)
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("failed to get app data dir: {e}"))
}

fn read_json_config<T: serde::de::DeserializeOwned>(
    app: &AppHandle,
    filename: &str,
    default: T,
) -> Result<T, String> {
    let path = config_dir(app)?.join(filename);
    if !path.exists() {
        return Ok(default);
    }
    let data = std::fs::read_to_string(&path)
        .map_err(|e| format!("failed to read config: {e}"))?;
    serde_json::from_str(&data).map_err(|e| format!("failed to parse config: {e}"))
}

fn write_json_config<T: serde::Serialize>(
    app: &AppHandle,
    filename: &str,
    data: &T,
) -> Result<(), String> {
    let dir = config_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("failed to create config dir: {e}"))?;
    let path = dir.join(filename);
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| format!("failed to serialize config: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("failed to write config: {e}"))
}

#[tauri::command]
pub async fn git_is_valid_repo(repo_path: String) -> Result<bool, String> {
    git_service().is_valid_repo(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_open_repo(repo_path: String) -> Result<RepoInfo, String> {
    git_service().open_repo(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_close_repo(repo_path: String) -> Result<(), String> {
    git_service().close_repo(&repo_path);
    Ok(())
}

#[tauri::command]
pub async fn git_watch_repo(repo_path: String) -> Result<(), String> {
    crate::watcher::watch_repo(repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_unwatch_repo(repo_path: String) -> Result<(), String> {
    crate::watcher::unwatch_repo(repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_status(repo_path: String) -> Result<GitStatus, String> {
    git_service().get_status(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    git_service().get_branches(&repo_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_log(
    repo_path: String,
    max_count: usize,
    skip: usize,
) -> Result<Vec<CommitInfo>, String> {
    git_service()
        .get_log(&repo_path, max_count, skip)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_diff(
    repo_path: String,
    commit_hash: Option<String>,
    file_path: Option<String>,
) -> Result<Vec<DiffFile>, String> {
    git_service()
        .get_diff(&repo_path, commit_hash.as_deref(), file_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_working_diff(
    repo_path: String,
    file_path: Option<String>,
) -> Result<Vec<DiffFile>, String> {
    git_service()
        .get_working_diff(&repo_path, file_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_staged_diff(
    repo_path: String,
    file_path: Option<String>,
) -> Result<Vec<DiffFile>, String> {
    git_service()
        .get_staged_diff(&repo_path, file_path.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_get_commit_diff(
    repo_path: String,
    commit_hash: String,
) -> Result<Vec<DiffFile>, String> {
    git_service()
        .get_commit_diff(&repo_path, &commit_hash)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_stage(repo_path: String, file_paths: Vec<String>) -> Result<(), String> {
    git_service()
        .stage(&repo_path, &file_paths)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_unstage(repo_path: String, file_paths: Vec<String>) -> Result<(), String> {
    git_service()
        .unstage(&repo_path, &file_paths)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    git_service()
        .commit(&repo_path, &message)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_checkout(
    repo_path: String,
    target: String,
    create_branch: bool,
) -> Result<(), String> {
    git_service()
        .checkout(&repo_path, &target, create_branch)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_create_branch(
    repo_path: String,
    branch_name: String,
    from: Option<String>,
) -> Result<(), String> {
    git_service()
        .create_branch(&repo_path, &branch_name, from.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_push(
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<(), String> {
    git_service()
        .push(&repo_path, remote.as_deref(), branch.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_pull(
    repo_path: String,
    remote: Option<String>,
    branch: Option<String>,
) -> Result<String, String> {
    git_service()
        .pull(&repo_path, remote.as_deref(), branch.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_fetch(
    repo_path: String,
    remote: Option<String>,
) -> Result<(), String> {
    git_service()
        .fetch(&repo_path, remote.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_merge(
    repo_path: String,
    branch_name: String,
) -> Result<String, String> {
    git_service()
        .merge(&repo_path, &branch_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_rebase(
    repo_path: String,
    branch_name: String,
) -> Result<String, String> {
    git_service()
        .rebase(&repo_path, &branch_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_delete_branch(
    repo_path: String,
    branch_name: String,
    force: bool,
) -> Result<(), String> {
    git_service()
        .delete_branch(&repo_path, &branch_name, force)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_rename_branch(
    repo_path: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    git_service()
        .rename_branch(&repo_path, &old_name, &new_name)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_list_worktrees(
    repo_path: String,
) -> Result<Vec<WorktreeInfo>, String> {
    git_service()
        .list_worktrees(&repo_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_add_worktree(
    repo_path: String,
    name: String,
    path: String,
    reference: Option<String>,
) -> Result<WorktreeInfo, String> {
    git_service()
        .add_worktree(&repo_path, &name, &path, reference.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn git_remove_worktree(
    repo_path: String,
    name: String,
) -> Result<(), String> {
    git_service()
        .remove_worktree(&repo_path, &name)
        .map_err(|e| e.to_string())
}
