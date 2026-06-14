use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::HashMap,
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{AppHandle, Emitter};

const WATCH_DEBOUNCE_MS: u64 = 500;

type WatcherMap = Arc<Mutex<HashMap<String, (RecommendedWatcher, Arc<Mutex<Option<tokio::time::Instant>>>)>>>;

lazy_static::lazy_static! {
    static ref APP_HANDLE: Mutex<Option<AppHandle>> = Mutex::new(None);
    static ref WATCHERS: WatcherMap = Arc::new(Mutex::new(HashMap::new()));
}

pub fn init(handle: AppHandle) {
    *APP_HANDLE.lock().unwrap() = Some(handle);
}

fn app_handle() -> Option<AppHandle> {
    APP_HANDLE.lock().unwrap().clone()
}

pub fn watch_repo(repo_path: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().unwrap();
    if watchers.contains_key(&repo_path) {
        return Ok(());
    }

    let repo = git2::Repository::open(&repo_path).map_err(|e| e.to_string())?;
    let git_dir = repo.path().to_path_buf();
    let paths = vec![
        git_dir.join("HEAD"),
        git_dir.join("index"),
        git_dir.join("refs").join("heads"),
        git_dir.join("refs").join("remotes"),
        git_dir.join("logs").join("HEAD"),
    ];

    let last_event = Arc::new(Mutex::new(None));
    let last_event_clone = last_event.clone();
    let repo_path_clone = repo_path.clone();

    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            if res.is_ok() {
                let mut last = last_event_clone.lock().unwrap();
                *last = Some(tokio::time::Instant::now());
                let repo_path = repo_path_clone.clone();
                drop(last);
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(WATCH_DEBOUNCE_MS)).await;
                    if let Some(handle) = app_handle() {
                        let _ = handle.emit("git:repoChanged", repo_path);
                    }
                });
            }
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    for path in paths {
        if path.exists() {
            let mode = if path.is_dir() {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };
            watcher
                .watch(&path, mode)
                .map_err(|e| format!("failed to watch {}: {}", path.display(), e))?;
        }
    }

    watchers.insert(repo_path, (watcher, last_event));
    Ok(())
}

pub fn unwatch_repo(repo_path: String) -> Result<(), String> {
    let mut watchers = WATCHERS.lock().unwrap();
    if let Some((mut watcher, _)) = watchers.remove(&repo_path) {
        watcher
            .unwatch(Path::new(&repo_path))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
