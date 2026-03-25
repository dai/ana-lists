import { startTransition, useEffect, useState } from "react";

import type { DesiredAssignment } from "../../src/domain/lists-workspace";
import type { DashboardPayload, ListsWorkspaceView, StargazerView } from "../../src/shared/contracts";
import { api } from "./api";

type FilterState = {
	query: string;
	repositoryId: string;
	tag: string;
	minFollowers: string;
	savedOnly: boolean;
};

const initialFilters: FilterState = {
	query: "",
	repositoryId: "",
	tag: "",
	minFollowers: "",
	savedOnly: false,
};

export function App() {
	const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
	const [stargazers, setStargazers] = useState<StargazerView[]>([]);
	const [filters, setFilters] = useState<FilterState>(initialFilters);
	const [trackInput, setTrackInput] = useState("");
	const [importText, setImportText] = useState("");
	const [status, setStatus] = useState("Loading workspace...");
	const [error, setError] = useState("");
	const [savingUserId, setSavingUserId] = useState<number | null>(null);
	const [desiredAssignments, setDesiredAssignments] = useState<DesiredAssignment[]>([]);

	useEffect(() => {
		void loadDashboard();
	}, []);

	useEffect(() => {
		if (!dashboard) {
			return;
		}

		setStargazers(dashboard.stargazers);
		setDesiredAssignments(dashboard.listsWorkspace.desiredAssignments);
	}, [dashboard]);

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			if (event.data?.type !== "github-stars-import") {
				return;
			}

			startTransition(() => {
				setStatus("Received import payload from GitHub helper...");
			});

			void handleImport(event.data.payload);
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, [dashboard]);

	async function loadDashboard() {
		try {
			setError("");
			const payload = await api.getDashboard();
			setDashboard(payload);
			setStatus(payload.auth.authenticated ? "Workspace loaded" : "Awaiting authentication");
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to load workspace");
		}
	}

	async function applyFilters(nextFilters = filters) {
		try {
			setError("");
			setStatus("Refreshing stargazers...");
			const rows = await api.getStargazers({
				query: nextFilters.query || undefined,
				repositoryId: nextFilters.repositoryId ? Number(nextFilters.repositoryId) : undefined,
				tag: nextFilters.tag || undefined,
				minFollowers: nextFilters.minFollowers ? Number(nextFilters.minFollowers) : undefined,
				savedOnly: nextFilters.savedOnly || undefined,
			});
			setStargazers(rows);
			setStatus(`Showing ${rows.length} stargazers`);
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to refresh stargazers");
		}
	}

	async function handleTrackRepository(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		try {
			setError("");
			setStatus(`Tracking ${trackInput}...`);
			await api.trackRepository(trackInput);
			setTrackInput("");
			await loadDashboard();
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to track repository");
		}
	}

	async function handleSyncRepository(repositoryId: number) {
		try {
			setError("");
			setStatus("Syncing stargazers from GitHub...");
			await api.syncRepository(repositoryId);
			await loadDashboard();
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to sync repository");
		}
	}

	async function handleSaveAnnotation(stargazer: StargazerView) {
		try {
			setSavingUserId(stargazer.githubUserId);
			setError("");
			const tags = prompt("Comma-separated tags", stargazer.tags.join(", ")) ?? stargazer.tags.join(", ");
			const note = prompt("Private note", stargazer.note) ?? stargazer.note;
			const saved = confirm("Mark this stargazer as saved?");
			const response = await api.saveAnnotation(stargazer.githubUserId, {
				tags: tags
					.split(",")
					.map((value) => value.trim())
					.filter(Boolean),
				note,
				saved,
			});
			setStargazers(response.stargazers);
			setStatus(`Updated ${stargazer.login}`);
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to save annotation");
		} finally {
			setSavingUserId(null);
		}
	}

	async function handleImport(payload?: unknown) {
		try {
			setError("");
			setStatus("Importing GitHub stars and lists...");
			const parsedPayload = payload ?? JSON.parse(importText);
			await api.importLists(parsedPayload);
			setImportText("");
			await loadDashboard();
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to import GitHub lists");
		}
	}

	async function handleSaveDesiredAssignments() {
		try {
			setError("");
			setStatus("Saving desired list plan...");
			const workspace = await api.saveDesiredAssignments(desiredAssignments);
			updateWorkspace(workspace);
			setStatus("Desired list plan saved");
		} catch (caughtError) {
			setError(
				caughtError instanceof Error ? caughtError.message : "Failed to save desired assignments",
			);
		}
	}

	async function handleRecomputeQueue() {
		try {
			setError("");
			setStatus("Recomputing queue...");
			const workspace = await api.recomputeQueue();
			updateWorkspace(workspace);
			setStatus("Queue recomputed");
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to recompute queue");
		}
	}

	function updateWorkspace(workspace: ListsWorkspaceView) {
		setDashboard((current) =>
			current
				? {
						...current,
						listsWorkspace: workspace,
					}
				: current,
		);
		setDesiredAssignments(workspace.desiredAssignments);
	}

	function toggleDesiredAssignment(githubRepoId: number, githubListId: string, enabled: boolean) {
		setDesiredAssignments((current) => {
			const withoutMatch = current.filter(
				(item) =>
					!(item.githubRepoId === githubRepoId && item.githubListId === githubListId),
			);

			if (!enabled) {
				return withoutMatch;
			}

			return [
				...withoutMatch,
				{
					githubRepoId,
					githubListId,
					reason: "Selected in workspace",
				},
			];
		});
	}

	async function handleCopyBookmarklet() {
		if (!dashboard) {
			return;
		}

		await navigator.clipboard.writeText(dashboard.importHelper.bookmarklet);
		setStatus("Bookmarklet copied to clipboard");
	}

	async function handleLogout() {
		await api.logout();
		await loadDashboard();
	}

	const workspace = dashboard?.listsWorkspace;

	return (
		<div className="app-shell">
			<header className="hero">
				<div>
					<p className="eyebrow">Private CRM for GitHub signals</p>
					<h1>Track stargazers, map your GitHub Lists, and plan bulk cleanup.</h1>
					<p className="hero-copy">
						The app stores your research privately, lets you sync stargazers on demand,
						and builds a reviewable desired-state queue for official GitHub Lists.
					</p>
				</div>
				<div className="status-panel">
					<div className="status-row">
						<span>Status</span>
						<strong>{status}</strong>
					</div>
					<div className="status-row">
						<span>User</span>
						<strong>{dashboard?.auth.user?.githubLogin ?? "Anonymous"}</strong>
					</div>
					<div className="status-row">
						<span>List limit</span>
						<strong>{dashboard?.listLimit ?? 32}</strong>
					</div>
					{dashboard?.auth.user && (
						<button className="ghost-button" onClick={() => void handleLogout()}>
							Log out
						</button>
					)}
				</div>
			</header>

			{error && <div className="error-banner">{error}</div>}

			<section className="layout-grid">
				<div className="panel">
					<div className="panel-header">
						<h2>Tracked Repos</h2>
						<p>Register any public repository and sync its stargazers manually.</p>
					</div>

					<form className="track-form" onSubmit={(event) => void handleTrackRepository(event)}>
						<input
							className="text-input"
							value={trackInput}
							onChange={(event) => setTrackInput(event.target.value)}
							placeholder="owner/repository"
						/>
						<button className="primary-button" type="submit">
							Track repo
						</button>
					</form>

					<div className="repo-list">
						{dashboard?.trackedRepositories.length ? (
							dashboard.trackedRepositories.map((repository) => (
								<div className="repo-card" key={repository.id}>
									<div>
										<h3>{repository.fullName}</h3>
										<p>{repository.description || "No repository description yet."}</p>
										<small>
											{repository.stargazerCount} stargazers synced
											{repository.lastSyncedAt ? ` • last sync ${formatDate(repository.lastSyncedAt)}` : ""}
										</small>
									</div>
									<button
										className="secondary-button"
										onClick={() => void handleSyncRepository(repository.id)}
									>
										Sync stargazers
									</button>
								</div>
							))
						) : (
							<p className="empty-state">No tracked repositories yet.</p>
						)}
					</div>
				</div>

				<div className="panel">
					<div className="panel-header">
						<h2>Auth + Import</h2>
						<p>Self-only mode works immediately. OAuth is available when GitHub credentials are configured.</p>
					</div>

					<div className="auth-stack">
						{dashboard?.auth.authenticated ? (
							<p className="helper-copy">Signed in as <strong>{dashboard.auth.user?.githubLogin}</strong>.</p>
						) : dashboard?.auth.githubConfigured ? (
							<a className="primary-button inline-link" href="/api/auth/github/start">
								Connect GitHub
							</a>
						) : (
							<p className="helper-copy">
								Set <code>SELF_ONLY_GITHUB_LOGIN</code> for self-only mode or configure GitHub OAuth env vars.
							</p>
						)}

						<button className="secondary-button" onClick={() => void handleCopyBookmarklet()}>
							Copy import bookmarklet
						</button>
						<p className="helper-copy">
							Open your app first, then run the bookmarklet on GitHub&apos;s stars page or a GitHub List page.
							The helper sends a best-effort payload into this workspace.
						</p>
						<textarea
							className="import-area"
							value={importText}
							onChange={(event) => setImportText(event.target.value)}
							placeholder="Paste import JSON here if you want a manual fallback."
						/>
						<button className="primary-button" onClick={() => void handleImport()}>
							Import pasted JSON
						</button>
					</div>
				</div>
			</section>

			<section className="layout-grid wide">
				<div className="panel">
					<div className="panel-header">
						<h2>Stargazer Explorer</h2>
						<p>Search across tracked repositories and keep private annotations on interesting people.</p>
					</div>

					<div className="filters">
						<input
							className="text-input"
							value={filters.query}
							onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
							placeholder="Search login, bio, company, note"
						/>
						<select
							className="text-input"
							value={filters.repositoryId}
							onChange={(event) =>
								setFilters((current) => ({ ...current, repositoryId: event.target.value }))
							}
						>
							<option value="">All tracked repos</option>
							{dashboard?.trackedRepositories.map((repository) => (
								<option key={repository.id} value={repository.id}>
									{repository.fullName}
								</option>
							))}
						</select>
						<input
							className="text-input"
							value={filters.tag}
							onChange={(event) => setFilters((current) => ({ ...current, tag: event.target.value }))}
							placeholder="Tag"
						/>
						<input
							className="text-input"
							value={filters.minFollowers}
							onChange={(event) =>
								setFilters((current) => ({ ...current, minFollowers: event.target.value }))
							}
							placeholder="Min followers"
						/>
						<label className="checkbox">
							<input
								type="checkbox"
								checked={filters.savedOnly}
								onChange={(event) =>
									setFilters((current) => ({ ...current, savedOnly: event.target.checked }))
								}
							/>
							Saved only
						</label>
						<button className="secondary-button" onClick={() => void applyFilters()}>
							Apply filters
						</button>
					</div>

					<div className="stargazer-grid">
						{stargazers.length ? (
							stargazers.map((stargazer) => (
								<article className="stargazer-card" key={stargazer.githubUserId}>
									<div className="stargazer-head">
										<div>
											<h3>{stargazer.login}</h3>
											<p>{stargazer.name || "No display name"}</p>
										</div>
										<button
											className="ghost-button"
											disabled={savingUserId === stargazer.githubUserId}
											onClick={() => void handleSaveAnnotation(stargazer)}
										>
											{savingUserId === stargazer.githubUserId ? "Saving..." : "Edit notes"}
										</button>
									</div>
									<p className="compact-copy">{stargazer.bio || "No bio available."}</p>
									<div className="metric-row">
										<span>{stargazer.company || "Independent"}</span>
										<span>{stargazer.followers} followers</span>
										<span>{stargazer.publicRepos} repos</span>
									</div>
									<div className="tag-row">
										{stargazer.tags.length ? stargazer.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>) : <span className="tag muted">No tags</span>}
										{stargazer.saved && <span className="tag accent">Saved</span>}
									</div>
									<p className="compact-copy note">{stargazer.note || "No private note yet."}</p>
									<small>
										Seen in {stargazer.repositories.map((repository) => repository.fullName).join(", ")}
									</small>
								</article>
							))
						) : (
							<p className="empty-state">No stargazers to show. Track and sync a repository first.</p>
						)}
					</div>
				</div>

				<div className="panel">
					<div className="panel-header">
						<h2>Lists Workspace</h2>
						<p>Review the current GitHub state, edit the desired state, and build a review queue.</p>
					</div>

					<div className="workspace-actions">
						<button className="secondary-button" onClick={() => void handleSaveDesiredAssignments()}>
							Save desired state
						</button>
						<button className="primary-button" onClick={() => void handleRecomputeQueue()}>
							Recompute queue
						</button>
						<span className="helper-copy">
							Last import: {workspace?.lastImportedAt ? formatDate(workspace.lastImportedAt) : "never"}
						</span>
					</div>

					<div className="list-columns">
						<div className="list-column">
							<h3>Official Lists</h3>
							{workspace?.lists.length ? (
								workspace.lists.map((list) => (
									<div className="list-chip" key={list.githubListId}>
										<strong>{list.name}</strong>
										<span>{list.description || "No description"}</span>
									</div>
								))
							) : (
								<p className="empty-state">Import GitHub Lists to populate this workspace.</p>
							)}
						</div>

						<div className="list-column stretch">
							<h3>Desired state editor</h3>
							<div className="workspace-table">
								{workspace?.repositories.map((repository) => (
									<div className="workspace-row" key={repository.githubRepoId}>
										<div>
											<strong>{repository.fullName}</strong>
											<p>{repository.description || "No description"}</p>
											<div className="tag-row">
												{repository.labels.slice(0, 6).map((label) => (
													<span className="tag muted" key={label}>
														{label}
													</span>
												))}
											</div>
										</div>
										<div className="checkbox-grid">
											{workspace.lists.map((list) => {
												const checked = desiredAssignments.some(
													(item) =>
														item.githubRepoId === repository.githubRepoId &&
														item.githubListId === list.githubListId,
												);

												return (
													<label className="checkbox" key={`${repository.githubRepoId}-${list.githubListId}`}>
														<input
															type="checkbox"
															checked={checked}
															onChange={(event) =>
																toggleDesiredAssignment(
																	repository.githubRepoId,
																	list.githubListId,
																	event.target.checked,
																)
															}
														/>
														{list.name}
													</label>
												);
											})}
										</div>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="diff-grid">
						<div>
							<h3>Diff</h3>
							<div className="diff-stack">
								{workspace?.diff.additions.map((item) => (
									<div className="diff-card add" key={`add-${item.githubRepoId}-${item.githubListId}`}>
										<strong>Add</strong>
										<span>{item.fullName} → {item.listName}</span>
										<small>{item.reason}</small>
									</div>
								))}
								{workspace?.diff.removals.map((item) => (
									<div className="diff-card remove" key={`remove-${item.githubRepoId}-${item.githubListId}`}>
										<strong>Remove</strong>
										<span>{item.fullName} → {item.listName}</span>
									</div>
								))}
								{workspace && workspace.diff.additions.length === 0 && workspace.diff.removals.length === 0 && (
									<p className="empty-state">No diff. Current GitHub state already matches the desired plan.</p>
								)}
							</div>
						</div>

						<div>
							<h3>Bulk candidates</h3>
							<div className="diff-stack">
								{workspace?.bulkCandidates.map((candidate) => (
									<div className="diff-card" key={candidate.githubListId}>
										<strong>{candidate.listName}</strong>
										<span>{candidate.repositoryNames.join(", ")}</span>
										<small>{candidate.reason}</small>
									</div>
								))}
								{workspace?.bulkCandidates.length === 0 && (
									<p className="empty-state">No automatic bulk suggestions yet.</p>
								)}
							</div>
						</div>

						<div>
							<h3>Queue</h3>
							<div className="diff-stack">
								{workspace?.queue.map((item) => (
									<div className="diff-card" key={item.id}>
										<strong>{item.actionType.toUpperCase()}</strong>
										<span>{item.fullName} → {item.listName}</span>
										<small>{item.state}</small>
									</div>
								))}
								{workspace?.queue.length === 0 && (
									<p className="empty-state">Run “Recompute queue” to capture the current diff as review items.</p>
								)}
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="panel">
				<div className="panel-header">
					<h2>Sync history</h2>
					<p>Manual syncs and imports are tracked so you can see what changed and when.</p>
				</div>
				<div className="history-grid">
					{dashboard?.syncRuns.length ? (
						dashboard.syncRuns.map((run) => (
							<div className="history-card" key={run.id}>
								<strong>{run.kind}</strong>
								<span>{run.target}</span>
								<small>{run.status}</small>
								<p>{run.message || "No extra message"}</p>
							</div>
						))
					) : (
						<p className="empty-state">No sync history yet.</p>
					)}
				</div>
			</section>
		</div>
	);
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}
