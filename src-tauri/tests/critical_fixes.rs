// Temporary verification tests for the C1-C4 fixes.
use git_hydra::git_service::GitService;
use std::fs;
use std::path::{Path, PathBuf};

fn setup(name: &str) -> (PathBuf, git2::Repository) {
    let dir = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join(name);
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let repo = git2::Repository::init(&dir).unwrap();
    let mut cfg = repo.config().unwrap();
    cfg.set_str("user.name", "Test").unwrap();
    cfg.set_str("user.email", "test@example.com").unwrap();
    (dir, repo)
}

fn write(dir: &Path, name: &str, content: &str) {
    fs::write(dir.join(name), content).unwrap();
}

#[test]
fn c4_initial_commit_on_empty_repo() {
    let (dir, repo) = setup("c4_empty");
    let svc = GitService::new();
    let p = dir.to_str().unwrap();

    write(&dir, "a.txt", "hello");
    svc.stage(p, &["a.txt".into()]).unwrap();
    let oid = svc.commit(p, "initial").unwrap();

    let commit = repo.find_commit(git2::Oid::from_str(&oid).unwrap()).unwrap();
    assert_eq!(commit.parent_count(), 0, "initial commit must have no parents");
}

#[test]
fn c3_stage_deleted_file() {
    let (dir, repo) = setup("c3_delete");
    let svc = GitService::new();
    let p = dir.to_str().unwrap();

    write(&dir, "a.txt", "hello");
    svc.stage(p, &["a.txt".into()]).unwrap();
    svc.commit(p, "initial").unwrap();

    fs::remove_file(dir.join("a.txt")).unwrap();
    svc.stage(p, &["a.txt".into()]).unwrap();
    let oid = svc.commit(p, "delete a").unwrap();

    let commit = repo.find_commit(git2::Oid::from_str(&oid).unwrap()).unwrap();
    assert!(
        commit.tree().unwrap().get_name("a.txt").is_none(),
        "a.txt must be gone from the committed tree"
    );
}

#[test]
fn c2_checkout_preserves_dirty_changes() {
    let (dir, repo) = setup("c2_dirty");
    let svc = GitService::new();
    let p = dir.to_str().unwrap();

    write(&dir, "a.txt", "v1");
    svc.stage(p, &["a.txt".into()]).unwrap();
    svc.commit(p, "c1").unwrap();
    let default_branch = repo.head().unwrap().shorthand().unwrap().to_string();

    svc.checkout(p, "feature", true).unwrap();
    write(&dir, "a.txt", "v2");
    svc.stage(p, &["a.txt".into()]).unwrap();
    svc.commit(p, "c2").unwrap();

    svc.checkout(p, &default_branch, false).unwrap();
    assert_eq!(fs::read_to_string(dir.join("a.txt")).unwrap(), "v1");

    write(&dir, "a.txt", "local changes");
    let res = svc.checkout(p, "feature", false);
    assert!(res.is_err(), "checkout over dirty changes must fail");
    assert_eq!(
        fs::read_to_string(dir.join("a.txt")).unwrap(),
        "local changes",
        "local changes must be preserved"
    );
}

#[test]
fn c1_lock_file_not_deleted() {
    let (dir, _repo) = setup("c1_lock");
    let svc = GitService::new();
    let p = dir.to_str().unwrap();

    write(&dir, "a.txt", "hello");
    svc.stage(p, &["a.txt".into()]).unwrap();
    svc.commit(p, "initial").unwrap();

    let lock = dir.join(".git").join("index.lock");
    fs::write(&lock, "").unwrap();

    let res = svc.checkout(p, "newb", true);
    assert!(res.is_err(), "mutation must fail while lock exists");
    assert!(lock.exists(), "lock file must not be deleted");
}

#[test]
fn c4_merge_commit_has_two_parents_and_cleans_state() {
    let (dir, repo) = setup("c4_merge");
    let svc = GitService::new();
    let p = dir.to_str().unwrap();

    write(&dir, "a.txt", "base");
    svc.stage(p, &["a.txt".into()]).unwrap();
    svc.commit(p, "base").unwrap();
    let default_branch = repo.head().unwrap().shorthand().unwrap().to_string();

    svc.checkout(p, "feature", true).unwrap();
    write(&dir, "b.txt", "feature");
    svc.stage(p, &["b.txt".into()]).unwrap();
    svc.commit(p, "feature commit").unwrap();

    svc.checkout(p, &default_branch, false).unwrap();
    write(&dir, "c.txt", "main side");
    svc.stage(p, &["c.txt".into()]).unwrap();
    svc.commit(p, "main commit").unwrap();

    // Put the repo into a merge state (MERGE_HEAD set) as `git merge` would.
    let feature = repo.revparse_single("feature").unwrap().peel_to_commit().unwrap();
    let annotated = repo.find_annotated_commit(feature.id()).unwrap();
    repo.merge(&[&annotated], None, None).unwrap();

    let oid = svc.commit(p, "merge feature").unwrap();

    let fresh = git2::Repository::open(&dir).unwrap();
    let commit = fresh.find_commit(git2::Oid::from_str(&oid).unwrap()).unwrap();
    assert_eq!(commit.parent_count(), 2, "merge commit must have two parents");
    assert_eq!(
        fresh.state(),
        git2::RepositoryState::Clean,
        "merge state must be cleaned up after commit"
    );
}
