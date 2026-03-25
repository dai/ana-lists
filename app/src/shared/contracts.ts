import type { DesiredAssignment } from "../domain/lists-workspace";
import type { StargazerRecord } from "../domain/stargazers";

export type AppUser = {
	id: number;
	githubLogin: string;
	name: string;
	avatarUrl: string;
	authMode: "anonymous" | "session" | "self-only";
};

export type TrackedRepositorySummary = {
	id: number;
	fullName: string;
	owner: string;
	repo: string;
	description: string;
	lastSyncedAt: string | null;
	stargazerCount: number;
};

export type StargazerView = StargazerRecord & {
	repositories: Array<{ id: number; fullName: string }>;
};

export type WorkspaceRepository = {
	githubRepoId: number;
	fullName: string;
	description: string;
	url: string;
	labels: string[];
	currentListIds: string[];
	desiredListIds: string[];
};

export type WorkspaceList = {
	githubListId: string;
	name: string;
	description: string;
};

export type QueueItem = {
	id: number;
	actionType: "add" | "remove";
	githubRepoId: number;
	githubListId: string;
	fullName: string;
	listName: string;
	reason: string;
	state: string;
};

export type SyncRunView = {
	id: number;
	kind: string;
	target: string;
	status: string;
	message: string;
	startedAt: string;
	completedAt: string | null;
};

export type ListsWorkspaceView = {
	repositories: WorkspaceRepository[];
	lists: WorkspaceList[];
	desiredAssignments: DesiredAssignment[];
	diff: {
		additions: Array<{
			githubRepoId: number;
			githubListId: string;
			fullName: string;
			listName: string;
			reason: string;
		}>;
		removals: Array<{
			githubRepoId: number;
			githubListId: string;
			fullName: string;
			listName: string;
		}>;
	};
	bulkCandidates: Array<{
		githubListId: string;
		listName: string;
		githubRepoIds: number[];
		repositoryNames: string[];
		reason: string;
	}>;
	queue: QueueItem[];
	lastImportedAt: string | null;
};

export type DashboardPayload = {
	auth: {
		user: AppUser | null;
		githubConfigured: boolean;
		authenticated: boolean;
	};
	trackedRepositories: TrackedRepositorySummary[];
	stargazers: StargazerView[];
	listsWorkspace: ListsWorkspaceView;
	syncRuns: SyncRunView[];
	listLimit: number;
	importHelper: {
		bookmarklet: string;
		origin: string;
	};
};
