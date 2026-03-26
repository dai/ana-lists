-- Add indexes to prevent full table scans and reduce D1 read costs

-- stargazer_snapshots: indexed for GROUP BY github_user_id queries in listStargazers
CREATE INDEX IF NOT EXISTS idx_stargazer_snapshots_github_user
  ON stargazer_snapshots (user_id, github_user_id);

-- tracked_repositories: indexed for listing by user
CREATE INDEX IF NOT EXISTS idx_tracked_repositories_user
  ON tracked_repositories (user_id, created_at DESC);

-- starred_repositories: indexed for workspace queries
CREATE INDEX IF NOT EXISTS idx_starred_repositories_user
  ON starred_repositories (user_id, full_name);

-- github_lists: indexed for workspace queries
CREATE INDEX IF NOT EXISTS idx_github_lists_user
  ON github_lists (user_id, name);

-- github_list_memberships: indexed for workspace queries
CREATE INDEX IF NOT EXISTS idx_github_list_memberships_user
  ON github_list_memberships (user_id);

-- desired_list_assignments: indexed for workspace queries
CREATE INDEX IF NOT EXISTS idx_desired_list_assignments_user
  ON desired_list_assignments (user_id);

-- bulk_action_queue: indexed for workspace queries
CREATE INDEX IF NOT EXISTS idx_bulk_action_queue_user
  ON bulk_action_queue (user_id, id DESC);

-- stargazer_annotations: index on user_id alone for lookups
CREATE INDEX IF NOT EXISTS idx_stargazer_annotations_user
  ON stargazer_annotations (user_id);
