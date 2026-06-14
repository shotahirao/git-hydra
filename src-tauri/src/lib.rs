pub mod commands;
pub mod git_service;
pub mod watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::platform,
            commands::get_recent_repos,
            commands::add_recent_repo,
            commands::remove_recent_repo,
            commands::get_session_tabs,
            commands::save_session_tabs,
            commands::git_is_valid_repo,
            commands::git_open_repo,
            commands::git_close_repo,
            commands::git_watch_repo,
            commands::git_unwatch_repo,
            commands::git_get_status,
            commands::git_get_branches,
            commands::git_get_log,
            commands::git_get_diff,
            commands::git_get_working_diff,
            commands::git_get_staged_diff,
            commands::git_get_commit_diff,
            commands::git_stage,
            commands::git_unstage,
            commands::git_commit,
            commands::git_checkout,
            commands::git_create_branch,
            commands::git_push,
            commands::git_pull,
            commands::git_fetch,
            commands::git_merge,
            commands::git_rebase,
            commands::git_delete_branch,
            commands::git_rename_branch,
            commands::git_list_worktrees,
            commands::git_add_worktree,
            commands::git_remove_worktree,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            watcher::init(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
