import type { DashboardPayload, ListsWorkspaceView, StargazerView } from "../../src/shared/contracts";
import type { DesiredAssignment } from "../../src/domain/lists-workspace";

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
	const response = await fetch(input, {
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});

	const body = (await response.json().catch(() => ({}))) as T & { error?: string };

	if (!response.ok) {
		throw new Error((body as { error?: string }).error ?? "Request failed");
	}

	return body;
}

export const api = {
	getDashboard() {
		return request<DashboardPayload>("/api/bootstrap");
	},
	trackRepository(fullName: string) {
		return request<{ repositories: DashboardPayload["trackedRepositories"] }>("/api/repos/track", {
			method: "POST",
			body: JSON.stringify({ fullName }),
		});
	},
	syncRepository(repositoryId: number) {
		return request<{
			trackedRepositories: DashboardPayload["trackedRepositories"];
			stargazers: StargazerView[];
		}>(`/api/repos/${repositoryId}/sync-stargazers`, {
			method: "POST",
		});
	},
	getStargazers(filters: Record<string, string | number | boolean | undefined>) {
		const params = new URLSearchParams();

		for (const [key, value] of Object.entries(filters)) {
			if (value !== undefined && value !== "" && value !== false) {
				params.set(key, String(value));
			}
		}

		return request<StargazerView[]>(`/api/stargazers?${params.toString()}`);
	},
	saveAnnotation(
		githubUserId: number,
		input: { tags: string[]; note: string; saved: boolean },
	) {
		return request<{ stargazers: StargazerView[] }>(`/api/stargazers/${githubUserId}/annotations`, {
			method: "POST",
			body: JSON.stringify(input),
		});
	},
	importLists(payload: unknown) {
		return request<{
			listsWorkspace: ListsWorkspaceView;
		}>("/api/import/github-stars-lists", {
			method: "POST",
			body: JSON.stringify(payload),
		});
	},
	saveDesiredAssignments(assignments: DesiredAssignment[]) {
		return request<ListsWorkspaceView>("/api/lists/desired-assignments", {
			method: "POST",
			body: JSON.stringify({ assignments }),
		});
	},
	recomputeQueue() {
		return request<ListsWorkspaceView>("/api/lists/bulk-candidates/recompute", {
			method: "POST",
		});
	},
	logout() {
		return request<{ ok: boolean }>("/api/auth/logout", {
			method: "POST",
		});
	},
};
