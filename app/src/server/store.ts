import {
	buildWorkspaceDiff,
	computeBulkCandidates,
	type DesiredAssignment,
	type ImportedList,
	type ImportedRepository,
	type ImportedRepositoryMembership,
} from "../domain/lists-workspace";
import { filterStargazers, type StargazerRecord } from "../domain/stargazers";
import type {
	AppUser,
	ListsWorkspaceView,
	QueueItem,
	StargazerView,
	SyncRunView,
	TrackedRepositorySummary,
	WorkspaceList,
	WorkspaceRepository,
} from "../shared/contracts";

type GithubProfileSeed = {
	githubUserId: number | null;
	githubLogin: string;
	name: string;
	avatarUrl: string;
};

type SessionRecord = {
	user: AppUser;
	accessToken: string | null;
};

type ImportPayload = {
	exportedAt: string;
	lists: ImportedList[];
	stars: Array<{
		githubRepoId: number;
		fullName: string;
		description: string;
		url: string;
	}>;
	memberships: ImportedRepositoryMembership[];
};

const D1_BATCH_CHUNK_SIZE = 100;

async function executeChunkedBatch(db: D1Database, statements: D1PreparedStatement[]) {
	for (let i = 0; i < statements.length; i += D1_BATCH_CHUNK_SIZE) {
		const chunk = statements.slice(i, i + D1_BATCH_CHUNK_SIZE);
		await db.batch(chunk);
	}
}

export class D1Store {
	constructor(private readonly db: D1Database) {}

	async ensureUser(seed: GithubProfileSeed, authMode: AppUser["authMode"]) {
		const now = new Date().toISOString();

		await this.db
			.prepare(
				`INSERT INTO users (github_user_id, github_login, name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(github_login) DO UPDATE SET
           github_user_id = excluded.github_user_id,
           name = excluded.name,
           avatar_url = excluded.avatar_url,
           updated_at = excluded.updated_at`,
			)
			.bind(
				seed.githubUserId,
				seed.githubLogin,
				seed.name,
				seed.avatarUrl,
				now,
				now,
			)
			.run();

		return this.getUserByGithubLogin(seed.githubLogin, authMode);
	}

	async getUserByGithubLogin(login: string, authMode: AppUser["authMode"]) {
		const row = await this.db
			.prepare(
				`SELECT id, github_login, name, avatar_url
         FROM users
         WHERE github_login = ?`,
			)
			.bind(login)
			.first<{
				id: number;
				github_login: string;
				name: string;
				avatar_url: string;
			}>();

		if (!row) {
			return null;
		}

		return {
			id: row.id,
			githubLogin: row.github_login,
			name: row.name,
			avatarUrl: row.avatar_url,
			authMode,
		} satisfies AppUser;
	}

	async createSession(userId: number, accessToken: string | null) {
		const sessionId = crypto.randomUUID();
		const now = new Date().toISOString();
		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

		await this.db
			.prepare(
				`INSERT INTO sessions (id, user_id, access_token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
			)
			.bind(sessionId, userId, accessToken, expiresAt, now)
			.run();

		return sessionId;
	}

	async getSession(sessionId: string, authMode: AppUser["authMode"]): Promise<SessionRecord | null> {
		const row = await this.db
			.prepare(
				`SELECT
            s.access_token,
            u.id,
            u.github_login,
            u.name,
            u.avatar_url
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ?
           AND s.expires_at > ?`,
			)
			.bind(sessionId, new Date().toISOString())
			.first<{
				access_token: string | null;
				id: number;
				github_login: string;
				name: string;
				avatar_url: string;
			}>();

		if (!row) {
			return null;
		}

		return {
			accessToken: row.access_token,
			user: {
				id: row.id,
				githubLogin: row.github_login,
				name: row.name,
				avatarUrl: row.avatar_url,
				authMode,
			},
		};
	}

	async deleteSession(sessionId: string) {
		await this.db.prepare(`DELETE FROM sessions WHERE id = ?`).bind(sessionId).run();
	}

	async trackRepository(userId: number, fullName: string, description = "") {
		const [owner = "", repo = ""] = fullName.split("/");
		const now = new Date().toISOString();

		await this.db
			.prepare(
				`INSERT INTO tracked_repositories (user_id, owner, repo, full_name, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, full_name) DO UPDATE SET
           description = excluded.description,
           updated_at = excluded.updated_at`,
			)
			.bind(userId, owner, repo, fullName, description, now, now)
			.run();
	}

	async getTrackedRepository(userId: number, repositoryId: number) {
		return this.db
			.prepare(
				`SELECT id, owner, repo, full_name, description
         FROM tracked_repositories
         WHERE user_id = ? AND id = ?`,
			)
			.bind(userId, repositoryId)
			.first<{
				id: number;
				owner: string;
				repo: string;
				full_name: string;
				description: string;
			}>();
	}

	async listTrackedRepositories(userId: number): Promise<TrackedRepositorySummary[]> {
		const result = await this.db
			.prepare(
				`SELECT
            tr.id,
            tr.owner,
            tr.repo,
            tr.full_name,
            tr.description,
            tr.last_synced_at,
            COUNT(ss.github_user_id) AS stargazer_count
         FROM tracked_repositories tr
         LEFT JOIN stargazer_snapshots ss
           ON ss.tracked_repository_id = tr.id
           AND ss.user_id = tr.user_id
         WHERE tr.user_id = ?
         GROUP BY tr.id
         ORDER BY tr.created_at DESC`,
			)
			.bind(userId)
			.all<{
				id: number;
				owner: string;
				repo: string;
				full_name: string;
				description: string;
				last_synced_at: string | null;
				stargazer_count: number;
			}>();

		return (result.results ?? []).map((row) => ({
			id: row.id,
			owner: row.owner,
			repo: row.repo,
			fullName: row.full_name,
			description: row.description,
			lastSyncedAt: row.last_synced_at,
			stargazerCount: Number(row.stargazer_count ?? 0),
		}));
	}

	async replaceStargazers(
		userId: number,
		repositoryId: number,
		stargazers: StargazerRecord[],
	) {
		const now = new Date().toISOString();

		await this.db
			.prepare(
				`DELETE FROM stargazer_snapshots
         WHERE user_id = ? AND tracked_repository_id = ?`,
			)
			.bind(userId, repositoryId)
			.run();

		if (stargazers.length > 0) {
			const statements = stargazers.map((stargazer) =>
				this.db
					.prepare(
						`INSERT INTO stargazer_snapshots (
                  user_id,
                  tracked_repository_id,
                  github_user_id,
                  login,
                  name,
                  bio,
                  company,
                  followers,
                  public_repos,
                  starred_at,
                  snapshot_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						userId,
						repositoryId,
						stargazer.githubUserId,
						stargazer.login,
						stargazer.name,
						stargazer.bio,
						stargazer.company,
						stargazer.followers,
						stargazer.publicRepos,
						stargazer.starredAt,
						now,
					),
			);
			await executeChunkedBatch(this.db, statements);
		}

		await this.db
			.prepare(
				`UPDATE tracked_repositories
         SET last_synced_at = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
			)
			.bind(now, now, userId, repositoryId)
			.run();
	}

	async listStargazers(
		userId: number,
		filters: Parameters<typeof filterStargazers>[1],
	): Promise<StargazerView[]> {
		const stargazerRows = await this.db
			.prepare(
				`SELECT
            s.github_user_id,
            MIN(s.login) AS login,
            MIN(s.name) AS name,
            MIN(s.bio) AS bio,
            MIN(s.company) AS company,
            MAX(s.followers) AS followers,
            MAX(s.public_repos) AS public_repos,
            MAX(s.starred_at) AS starred_at,
            COALESCE(a.tags_json, '[]') AS tags_json,
            COALESCE(a.saved, 0) AS saved,
            COALESCE(a.note, '') AS note
         FROM stargazer_snapshots s
         LEFT JOIN stargazer_annotations a
           ON a.user_id = s.user_id
          AND a.github_user_id = s.github_user_id
         WHERE s.user_id = ?
         GROUP BY s.github_user_id
         ORDER BY MAX(s.starred_at) DESC
         LIMIT 1000`,
			)
			.bind(userId)
			.all<{
				github_user_id: number;
				login: string;
				name: string;
				bio: string;
				company: string;
				followers: number;
				public_repos: number;
				starred_at: string;
				tags_json: string;
				saved: number;
				note: string;
			}>();

		const repositoryRows = await this.db
			.prepare(
				`SELECT DISTINCT
            s.github_user_id,
            tr.id AS repository_id,
            tr.full_name
         FROM stargazer_snapshots s
         JOIN tracked_repositories tr ON tr.id = s.tracked_repository_id
         WHERE s.user_id = ?
         ORDER BY tr.full_name
         LIMIT 5000`,
			)
			.bind(userId)
			.all<{
				github_user_id: number;
				repository_id: number;
				full_name: string;
			}>();

		const repositoriesByUser = new Map<number, Array<{ id: number; fullName: string }>>();
		for (const row of repositoryRows.results ?? []) {
			const repositories = repositoriesByUser.get(row.github_user_id) ?? [];
			repositories.push({ id: row.repository_id, fullName: row.full_name });
			repositoriesByUser.set(row.github_user_id, repositories);
		}

		const records: StargazerView[] = (stargazerRows.results ?? []).map((row) => ({
			githubUserId: row.github_user_id,
			login: row.login,
			name: row.name,
			bio: row.bio,
			company: row.company,
			followers: Number(row.followers ?? 0),
			publicRepos: Number(row.public_repos ?? 0),
			starredAt: row.starred_at,
			repositoryIds: (repositoriesByUser.get(row.github_user_id) ?? []).map((repo) => repo.id),
			tags: parseJsonArray(row.tags_json),
			saved: Boolean(row.saved),
			note: row.note,
			repositories: repositoriesByUser.get(row.github_user_id) ?? [],
		}));

		return filterStargazers(records, filters).map((record) => ({
			...record,
			repositories: record.repositories,
		}));
	}

	async upsertStargazerAnnotation(
		userId: number,
		githubUserId: number,
		input: { tags: string[]; note: string; saved: boolean },
	) {
		const now = new Date().toISOString();

		await this.db
			.prepare(
				`INSERT INTO stargazer_annotations (user_id, github_user_id, tags_json, note, saved, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, github_user_id) DO UPDATE SET
           tags_json = excluded.tags_json,
           note = excluded.note,
           saved = excluded.saved,
           updated_at = excluded.updated_at`,
			)
			.bind(userId, githubUserId, JSON.stringify(input.tags), input.note, input.saved ? 1 : 0, now)
			.run();
	}

	async importGithubStarsAndLists(userId: number, payload: ImportPayload) {
		const importedAt = payload.exportedAt;

		await this.db.batch([
			this.db.prepare(`DELETE FROM github_list_memberships WHERE user_id = ?`).bind(userId),
			this.db.prepare(`DELETE FROM github_lists WHERE user_id = ?`).bind(userId),
			this.db.prepare(`DELETE FROM starred_repositories WHERE user_id = ?`).bind(userId),
		]);

		if (payload.lists.length > 0) {
			const statements = payload.lists.map((list) =>
				this.db
					.prepare(
						`INSERT INTO github_lists (user_id, github_list_id, name, description, imported_at)
                 VALUES (?, ?, ?, ?, ?)`,
					)
					.bind(userId, list.githubListId, list.name, list.description, importedAt),
			);
			await executeChunkedBatch(this.db, statements);
		}

		if (payload.stars.length > 0) {
			const statements = payload.stars.map((star) =>
				this.db
					.prepare(
						`INSERT INTO starred_repositories (
                  user_id,
                  github_repo_id,
                  full_name,
                  description,
                  url,
                  labels_json,
                  note,
                  imported_at
                ) VALUES (?, ?, ?, ?, ?, '[]', '', ?)`,
					)
					.bind(
						userId,
						star.githubRepoId,
						star.fullName,
						star.description,
						star.url,
						importedAt,
					),
			);
			await executeChunkedBatch(this.db, statements);
		}

		if (payload.memberships.length > 0) {
			const statements = payload.memberships.map((membership) =>
				this.db
					.prepare(
						`INSERT INTO github_list_memberships (
                  user_id,
                  github_repo_id,
                  github_list_id,
                  imported_at
                ) VALUES (?, ?, ?, ?)`,
					)
					.bind(
						userId,
						membership.githubRepoId,
						membership.githubListId,
						importedAt,
					),
			);
			await executeChunkedBatch(this.db, statements);
		}
	}

	async saveDesiredAssignments(userId: number, assignments: DesiredAssignment[]) {
		const now = new Date().toISOString();

		await this.db
			.prepare(`DELETE FROM desired_list_assignments WHERE user_id = ?`)
			.bind(userId)
			.run();

		if (assignments.length > 0) {
			const statements = assignments.map((assignment) =>
				this.db
					.prepare(
						`INSERT INTO desired_list_assignments (
                  user_id,
                  github_repo_id,
                  github_list_id,
                  reason,
                  updated_at
                ) VALUES (?, ?, ?, ?, ?)`,
					)
					.bind(
						userId,
						assignment.githubRepoId,
						assignment.githubListId,
						assignment.reason,
						now,
					),
			);
			await executeChunkedBatch(this.db, statements);
		}
	}

	async replaceBulkQueue(
		userId: number,
		diff: ListsWorkspaceView["diff"],
	) {
		const now = new Date().toISOString();

		await this.db
			.prepare(`DELETE FROM bulk_action_queue WHERE user_id = ?`)
			.bind(userId)
			.run();

		const statements = [
			...diff.additions.map((item) =>
				this.db
					.prepare(
						`INSERT INTO bulk_action_queue (
                user_id,
                action_type,
                github_repo_id,
                github_list_id,
                full_name,
                list_name,
                reason,
                state,
                created_at
              ) VALUES (?, 'add', ?, ?, ?, ?, ?, 'pending', ?)`,
					)
					.bind(
						userId,
						item.githubRepoId,
						item.githubListId,
						item.fullName,
						item.listName,
						item.reason,
						now,
					),
			),
			...diff.removals.map((item) =>
				this.db
					.prepare(
						`INSERT INTO bulk_action_queue (
                user_id,
                action_type,
                github_repo_id,
                github_list_id,
                full_name,
                list_name,
                reason,
                state,
                created_at
              ) VALUES (?, 'remove', ?, ?, ?, ?, '', 'pending', ?)`,
					)
					.bind(
						userId,
						item.githubRepoId,
						item.githubListId,
						item.fullName,
						item.listName,
						now,
					),
			),
		];

		if (statements.length > 0) {
			await executeChunkedBatch(this.db, statements);
		}
	}

	async getListsWorkspace(userId: number): Promise<ListsWorkspaceView> {
		const repositoryRows = await this.db
			.prepare(
				`SELECT
            github_repo_id,
            full_name,
            description,
            url,
            labels_json,
            imported_at
         FROM starred_repositories
         WHERE user_id = ?
         ORDER BY full_name
         LIMIT 5000`,
			)
			.bind(userId)
			.all<{
				github_repo_id: number;
				full_name: string;
				description: string;
				url: string;
				labels_json: string;
				imported_at: string | null;
			}>();

		const listRows = await this.db
			.prepare(
				`SELECT github_list_id, name, description
         FROM github_lists
         WHERE user_id = ?
         ORDER BY name
         LIMIT 1000`,
			)
			.bind(userId)
			.all<{
				github_list_id: string;
				name: string;
				description: string;
			}>();

		const membershipRows = await this.db
			.prepare(
				`SELECT github_repo_id, github_list_id
         FROM github_list_memberships
         WHERE user_id = ?
         LIMIT 10000`,
			)
			.bind(userId)
			.all<{
				github_repo_id: number;
				github_list_id: string;
			}>();

		const desiredRows = await this.db
			.prepare(
				`SELECT github_repo_id, github_list_id, reason
         FROM desired_list_assignments
         WHERE user_id = ?
         LIMIT 5000`,
			)
			.bind(userId)
			.all<{
				github_repo_id: number;
				github_list_id: string;
				reason: string;
			}>();

		const queueRows = await this.db
			.prepare(
				`SELECT
            id,
            action_type,
            github_repo_id,
            github_list_id,
            full_name,
            list_name,
            reason,
            state
         FROM bulk_action_queue
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 500`,
			)
			.bind(userId)
			.all<{
				id: number;
				action_type: "add" | "remove";
				github_repo_id: number;
				github_list_id: string;
				full_name: string;
				list_name: string;
				reason: string;
				state: string;
			}>();

		const lists: WorkspaceList[] = (listRows.results ?? []).map((row) => ({
			githubListId: row.github_list_id,
			name: row.name,
			description: row.description,
		}));

		const memberships: ImportedRepositoryMembership[] = (membershipRows.results ?? []).map(
			(row) => ({
				githubRepoId: row.github_repo_id,
				githubListId: row.github_list_id,
			}),
		);

		const desiredAssignments: DesiredAssignment[] =
			desiredRows.results && desiredRows.results.length > 0
				? desiredRows.results.map((row) => ({
						githubRepoId: row.github_repo_id,
						githubListId: row.github_list_id,
						reason: row.reason,
					}))
				: memberships.map((membership) => ({
						githubRepoId: membership.githubRepoId,
						githubListId: membership.githubListId,
						reason: "Imported from GitHub",
					}));

		const repositories: WorkspaceRepository[] = (repositoryRows.results ?? []).map((row) => {
			const currentListIds = memberships
				.filter((membership) => membership.githubRepoId === row.github_repo_id)
				.map((membership) => membership.githubListId);
			const desiredListIds = desiredAssignments
				.filter((assignment) => assignment.githubRepoId === row.github_repo_id)
				.map((assignment) => assignment.githubListId);

			return {
				githubRepoId: row.github_repo_id,
				fullName: row.full_name,
				description: row.description,
				url: row.url,
				labels: dedupe([
					...parseJsonArray(row.labels_json),
					...tokenize(`${row.full_name} ${row.description}`),
				]),
				currentListIds,
				desiredListIds,
			};
		});

		const diff = buildWorkspaceDiff({
			repositories: repositories.map(
				(repository): ImportedRepository => ({
					githubRepoId: repository.githubRepoId,
					fullName: repository.fullName,
					description: repository.description,
				}),
			),
			lists,
			memberships,
			desired: desiredAssignments,
		});

		const bulkCandidates = computeBulkCandidates({
			repositories: repositories.map(
				(repository): ImportedRepository => ({
					githubRepoId: repository.githubRepoId,
					fullName: repository.fullName,
					description: repository.description,
				}),
			),
			lists,
			memberships,
			annotations: repositories.map((repository) => ({
				githubRepoId: repository.githubRepoId,
				labels: repository.labels,
			})),
		});

		return {
			repositories,
			lists,
			desiredAssignments,
			diff,
			bulkCandidates,
			queue: (queueRows.results ?? []).map(
				(row): QueueItem => ({
					id: row.id,
					actionType: row.action_type,
					githubRepoId: row.github_repo_id,
					githubListId: row.github_list_id,
					fullName: row.full_name,
					listName: row.list_name,
					reason: row.reason,
					state: row.state,
				}),
			),
			lastImportedAt:
				(repositoryRows.results ?? [])
					.map((row) => row.imported_at)
					.filter((value): value is string => Boolean(value))
					.sort()
					.at(-1) ?? null,
		};
	}

	async startSyncRun(userId: number, kind: string, target: string) {
		const now = new Date().toISOString();
		const result = await this.db
			.prepare(
				`INSERT INTO sync_runs (user_id, kind, target, status, message, started_at)
         VALUES (?, ?, ?, 'running', '', ?)`,
			)
			.bind(userId, kind, target, now)
			.run();

		return Number(result.meta.last_row_id);
	}

	async finishSyncRun(runId: number, status: string, message: string) {
		await this.db
			.prepare(
				`UPDATE sync_runs
         SET status = ?, message = ?, completed_at = ?
         WHERE id = ?`,
			)
			.bind(status, message, new Date().toISOString(), runId)
			.run();
	}

	async listSyncRuns(userId: number): Promise<SyncRunView[]> {
		const result = await this.db
			.prepare(
				`SELECT id, kind, target, status, message, started_at, completed_at
         FROM sync_runs
         WHERE user_id = ?
         ORDER BY id DESC
         LIMIT 12`,
			)
			.bind(userId)
			.all<{
				id: number;
				kind: string;
				target: string;
				status: string;
				message: string;
				started_at: string;
				completed_at: string | null;
			}>();

		return (result.results ?? []).map((row) => ({
			id: row.id,
			kind: row.kind,
			target: row.target,
			status: row.status,
			message: row.message,
			startedAt: row.started_at,
			completedAt: row.completed_at,
		}));
	}
}

function parseJsonArray(value: string | null) {
	try {
		const parsed = JSON.parse(value ?? "[]");
		return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
	} catch {
		return [];
	}
}

function dedupe(values: string[]) {
	return [...new Set(values.filter(Boolean))];
}

function tokenize(value: string) {
	return value
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((part) => part.length > 2)
		.slice(0, 16);
}
