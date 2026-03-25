CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_user_id INTEGER,
  github_login TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  access_token TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracked_repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, full_name)
);

CREATE TABLE IF NOT EXISTS stargazer_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tracked_repository_id INTEGER NOT NULL,
  github_user_id INTEGER NOT NULL,
  login TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  followers INTEGER NOT NULL DEFAULT 0,
  public_repos INTEGER NOT NULL DEFAULT 0,
  starred_at TEXT NOT NULL,
  snapshot_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tracked_repository_id) REFERENCES tracked_repositories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stargazer_annotations (
  user_id INTEGER NOT NULL,
  github_user_id INTEGER NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  saved INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, github_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS starred_repositories (
  user_id INTEGER NOT NULL,
  github_repo_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  labels_json TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL,
  PRIMARY KEY (user_id, github_repo_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS github_lists (
  user_id INTEGER NOT NULL,
  github_list_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  imported_at TEXT NOT NULL,
  PRIMARY KEY (user_id, github_list_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS github_list_memberships (
  user_id INTEGER NOT NULL,
  github_repo_id INTEGER NOT NULL,
  github_list_id TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  PRIMARY KEY (user_id, github_repo_id, github_list_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS desired_list_assignments (
  user_id INTEGER NOT NULL,
  github_repo_id INTEGER NOT NULL,
  github_list_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, github_repo_id, github_list_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bulk_action_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  github_repo_id INTEGER NOT NULL,
  github_list_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  list_name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stargazer_snapshots_user_repo
  ON stargazer_snapshots (user_id, tracked_repository_id);

CREATE INDEX IF NOT EXISTS idx_sync_runs_user
  ON sync_runs (user_id, id DESC);
