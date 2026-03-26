import { startTransition, useEffect, useState } from "react";

import type { DesiredAssignment } from "../../src/domain/lists-workspace";
import type { DashboardPayload, ListsWorkspaceView, StargazerView } from "../../src/shared/contracts";
import { api } from "./api";
import { copy } from "./copy";
import {
	LANGUAGE_STORAGE_KEY,
	THEME_STORAGE_KEY,
	resolveInitialLanguage,
	resolveInitialTheme,
	type Language,
	type Theme,
} from "./ui-preferences";

type FilterState = {
	query: string;
	repositoryId: string;
	tag: string;
	minFollowers: string;
	savedOnly: boolean;
};

type StatusState =
	| { key: "loading" }
	| { key: "awaitingAuth" }
	| { key: "workspaceLoaded" }
	| { key: "receivedImport" }
	| { key: "refreshingStargazers" }
	| { key: "showingStargazers"; count: number }
	| { key: "trackingRepository"; fullName: string }
	| { key: "syncingStargazers" }
	| { key: "updatedUser"; login: string }
	| { key: "importingLists" }
	| { key: "savingDesiredState" }
	| { key: "desiredStateSaved" }
	| { key: "recomputingQueue" }
	| { key: "queueRecomputed" }
	| { key: "bookmarkletCopied" };

const initialFilters: FilterState = {
	query: "",
	repositoryId: "",
	tag: "",
	minFollowers: "",
	savedOnly: false,
};

export function App() {
	const [language, setLanguage] = useState<Language>(() =>
		resolveInitialLanguage({
			storedLanguage: safeStorageGet(LANGUAGE_STORAGE_KEY),
			navigatorLanguage: typeof navigator === "undefined" ? null : navigator.language,
		}),
	);
	const [theme, setTheme] = useState<Theme>(() =>
		resolveInitialTheme({
			storedTheme: safeStorageGet(THEME_STORAGE_KEY),
			prefersDark:
				typeof window !== "undefined" &&
				typeof window.matchMedia === "function" &&
				window.matchMedia("(prefers-color-scheme: dark)").matches,
		}),
	);
	const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
	const [stargazers, setStargazers] = useState<StargazerView[]>([]);
	const [filters, setFilters] = useState<FilterState>(initialFilters);
	const [trackInput, setTrackInput] = useState("");
	const [importText, setImportText] = useState("");
	const [status, setStatus] = useState<StatusState>({ key: "loading" });
	const [error, setError] = useState("");
	const [savingUserId, setSavingUserId] = useState<number | null>(null);
	const [desiredAssignments, setDesiredAssignments] = useState<DesiredAssignment[]>([]);

	const t = copy[language];

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		safeStorageSet(THEME_STORAGE_KEY, theme);
	}, [theme]);

	useEffect(() => {
		safeStorageSet(LANGUAGE_STORAGE_KEY, language);
	}, [language]);

	useEffect(() => {
		void loadDashboard();
		// eslint-disable-next-line react-hooks/exhaustive-deps
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
			if (event.origin !== window.location.origin) {
				return;
			}
			if (event.data?.type !== "github-stars-import") {
				return;
			}

			startTransition(() => {
				setStatus({ key: "receivedImport" });
			});

			void handleImport(event.data.payload);
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	async function loadDashboard() {
		try {
			setError("");
			const payload = await api.getDashboard();
			setDashboard(payload);
			setStatus({ key: payload.auth.authenticated ? "workspaceLoaded" : "awaitingAuth" });
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to load workspace");
		}
	}

	async function applyFilters(nextFilters = filters) {
		try {
			setError("");
			setStatus({ key: "refreshingStargazers" });
			const rows = await api.getStargazers({
				query: nextFilters.query || undefined,
				repositoryId: nextFilters.repositoryId ? Number(nextFilters.repositoryId) : undefined,
				tag: nextFilters.tag || undefined,
				minFollowers: nextFilters.minFollowers ? Number(nextFilters.minFollowers) : undefined,
				savedOnly: nextFilters.savedOnly || undefined,
			});
			setStargazers(rows);
			setStatus({ key: "showingStargazers", count: rows.length });
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to refresh stargazers");
		}
	}

	async function handleTrackRepository(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		try {
			setError("");
			setStatus({ key: "trackingRepository", fullName: trackInput });
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
			setStatus({ key: "syncingStargazers" });
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
			const tags =
				prompt(t.stargazers.promptTags, stargazer.tags.join(", ")) ?? stargazer.tags.join(", ");
			const note = prompt(t.stargazers.promptNote, stargazer.note) ?? stargazer.note;
			const saved = confirm(t.stargazers.promptSaved);
			const response = await api.saveAnnotation(stargazer.githubUserId, {
				tags: tags
					.split(",")
					.map((value) => value.trim())
					.filter(Boolean),
				note,
				saved,
			});
			setStargazers(response.stargazers);
			setStatus({ key: "updatedUser", login: stargazer.login });
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to save annotation");
		} finally {
			setSavingUserId(null);
		}
	}

	async function handleImport(payload?: unknown) {
		try {
			setError("");
			setStatus({ key: "importingLists" });
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
			setStatus({ key: "savingDesiredState" });
			const workspace = await api.saveDesiredAssignments(desiredAssignments);
			updateWorkspace(workspace);
			setStatus({ key: "desiredStateSaved" });
		} catch (caughtError) {
			setError(
				caughtError instanceof Error ? caughtError.message : "Failed to save desired assignments",
			);
		}
	}

	async function handleRecomputeQueue() {
		try {
			setError("");
			setStatus({ key: "recomputingQueue" });
			const workspace = await api.recomputeQueue();
			updateWorkspace(workspace);
			setStatus({ key: "queueRecomputed" });
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
		setStatus({ key: "bookmarkletCopied" });
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
					<p className="eyebrow">{t.hero.eyebrow}</p>
					<h1>{t.hero.title}</h1>
					<p className="hero-copy">{t.hero.description}</p>
				</div>
				<div className="status-panel">
					<div className="control-cluster">
						<div className="toggle-stack">
							<span className="toggle-label">{t.controls.language}</span>
							<div className="toggle-group" role="group" aria-label={t.controls.language}>
								{(["en", "ja"] as const).map((option) => (
									<button
										key={option}
										className={`toggle-button ${language === option ? "is-active" : ""}`}
										onClick={() => setLanguage(option)}
										type="button"
									>
										{t.languageOptions[option]}
									</button>
								))}
							</div>
						</div>
						<div className="toggle-stack">
							<span className="toggle-label">{t.controls.theme}</span>
							<div className="toggle-group" role="group" aria-label={t.controls.theme}>
								{(["light", "dark"] as const).map((option) => (
									<button
										key={option}
										className={`toggle-button ${theme === option ? "is-active" : ""}`}
										onClick={() => setTheme(option)}
										type="button"
									>
										{t.themeOptions[option]}
									</button>
								))}
							</div>
						</div>
					</div>
					<div className="status-row">
						<span>{t.statusCard.status}</span>
						<strong>{statusToText(status, t)}</strong>
					</div>
					<div className="status-row">
						<span>{t.statusCard.user}</span>
						<strong>{dashboard?.auth.user?.githubLogin ?? t.statusCard.anonymous}</strong>
					</div>
					<div className="status-row">
						<span>{t.statusCard.listLimit}</span>
						<strong>{dashboard?.listLimit ?? 32}</strong>
					</div>
					{dashboard?.auth.user && (
						<button className="ghost-button" onClick={() => void handleLogout()}>
							{t.controls.logout}
						</button>
					)}
				</div>
			</header>

			{error && <div className="error-banner">{error}</div>}

			<section className="layout-grid">
				<div className="panel">
					<div className="panel-header">
						<h2>{t.trackedRepos.title}</h2>
						<p>{t.trackedRepos.description}</p>
					</div>

					<form className="track-form" onSubmit={(event) => void handleTrackRepository(event)}>
						<input
							className="text-input"
							value={trackInput}
							onChange={(event) => setTrackInput(event.target.value)}
							placeholder={t.trackedRepos.placeholder}
						/>
						<button className="primary-button" type="submit">
							{t.trackedRepos.action}
						</button>
					</form>

					<div className="repo-list">
						{dashboard?.trackedRepositories.length ? (
							dashboard.trackedRepositories.map((repository) => (
								<div className="repo-card" key={repository.id}>
									<div>
										<h3>{repository.fullName}</h3>
										<p>{repository.description || t.trackedRepos.noDescription}</p>
										<small>
											{repository.stargazerCount} {t.trackedRepos.synced}
											{repository.lastSyncedAt
												? ` • ${t.trackedRepos.lastSync} ${formatDate(repository.lastSyncedAt, language)}`
												: ""}
										</small>
									</div>
									<button
										className="secondary-button"
										onClick={() => void handleSyncRepository(repository.id)}
									>
										{t.trackedRepos.syncAction}
									</button>
								</div>
							))
						) : (
							<p className="empty-state">{t.trackedRepos.empty}</p>
						)}
					</div>
				</div>

				<div className="panel">
					<div className="panel-header">
						<h2>{t.authImport.title}</h2>
						<p>{t.authImport.description}</p>
					</div>

					<div className="auth-stack">
						{dashboard?.auth.authenticated ? (
							<p className="helper-copy">
								{t.authImport.signedInAs} <strong>{dashboard.auth.user?.githubLogin}</strong>.
							</p>
						) : dashboard?.auth.githubConfigured ? (
							<a className="primary-button inline-link" href="/api/auth/github/start">
								{t.authImport.connectGithub}
							</a>
						) : (
							<p className="helper-copy">
								{t.authImport.selfOnlyHint.split("SELF_ONLY_GITHUB_LOGIN")[0]}
								<code>SELF_ONLY_GITHUB_LOGIN</code>
								{t.authImport.selfOnlyHint.split("SELF_ONLY_GITHUB_LOGIN")[1] ?? ""}
							</p>
						)}

						<button className="secondary-button" onClick={() => void handleCopyBookmarklet()}>
							{t.authImport.copyBookmarklet}
						</button>
						<p className="helper-copy">{t.authImport.helper}</p>
						<textarea
							className="import-area"
							value={importText}
							onChange={(event) => setImportText(event.target.value)}
							placeholder={t.authImport.importPlaceholder}
						/>
						<button className="primary-button" onClick={() => void handleImport()}>
							{t.authImport.importAction}
						</button>
					</div>
				</div>
			</section>

			<section className="layout-grid wide">
				<div className="panel">
					<div className="panel-header">
						<h2>{t.stargazers.title}</h2>
						<p>{t.stargazers.description}</p>
					</div>

					<div className="filters">
						<input
							className="text-input"
							value={filters.query}
							onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
							placeholder={t.stargazers.searchPlaceholder}
						/>
						<select
							className="text-input"
							value={filters.repositoryId}
							onChange={(event) =>
								setFilters((current) => ({ ...current, repositoryId: event.target.value }))
							}
						>
							<option value="">{t.stargazers.allTrackedRepos}</option>
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
							placeholder={t.stargazers.tagPlaceholder}
						/>
						<input
							className="text-input"
							value={filters.minFollowers}
							onChange={(event) =>
								setFilters((current) => ({ ...current, minFollowers: event.target.value }))
							}
							placeholder={t.stargazers.minFollowersPlaceholder}
						/>
						<label className="checkbox">
							<input
								type="checkbox"
								checked={filters.savedOnly}
								onChange={(event) =>
									setFilters((current) => ({ ...current, savedOnly: event.target.checked }))
								}
							/>
							{t.stargazers.savedOnly}
						</label>
						<button className="secondary-button" onClick={() => void applyFilters()}>
							{t.stargazers.applyFilters}
						</button>
					</div>

					<div className="stargazer-grid">
						{stargazers.length ? (
							stargazers.map((stargazer) => (
								<article className="stargazer-card" key={stargazer.githubUserId}>
									<div className="stargazer-head">
										<div>
											<h3>{stargazer.login}</h3>
											<p>{stargazer.name || t.stargazers.noName}</p>
										</div>
										<button
											className="ghost-button"
											disabled={savingUserId === stargazer.githubUserId}
											onClick={() => void handleSaveAnnotation(stargazer)}
										>
											{savingUserId === stargazer.githubUserId ? t.stargazers.saving : t.stargazers.editNotes}
										</button>
									</div>
									<p className="compact-copy">{stargazer.bio || t.stargazers.noBio}</p>
									<div className="metric-row">
										<span>{stargazer.company || t.stargazers.independent}</span>
										<span>{stargazer.followers} {t.stargazers.followers}</span>
										<span>{stargazer.publicRepos} {t.stargazers.repos}</span>
									</div>
									<div className="tag-row">
										{stargazer.tags.length ? (
											stargazer.tags.map((tag) => (
												<span className="tag" key={tag}>
													{tag}
												</span>
											))
										) : (
											<span className="tag muted">{t.stargazers.noTags}</span>
										)}
										{stargazer.saved && <span className="tag accent">{t.stargazers.saved}</span>}
									</div>
									<p className="compact-copy note">{stargazer.note || t.stargazers.noNote}</p>
									<small>
										{t.stargazers.seenIn}{" "}
										{stargazer.repositories.map((repository) => repository.fullName).join(", ")}
									</small>
								</article>
							))
						) : (
							<p className="empty-state">{t.stargazers.noResults}</p>
						)}
					</div>
				</div>

				<div className="panel">
					<div className="panel-header">
						<h2>{t.lists.title}</h2>
						<p>{t.lists.description}</p>
					</div>

					<div className="workspace-actions">
						<button className="secondary-button" onClick={() => void handleSaveDesiredAssignments()}>
							{t.lists.saveDesiredState}
						</button>
						<button className="primary-button" onClick={() => void handleRecomputeQueue()}>
							{t.lists.recomputeQueue}
						</button>
						<span className="helper-copy">
							{t.lists.lastImport}:{" "}
							{workspace?.lastImportedAt ? formatDate(workspace.lastImportedAt, language) : t.lists.never}
						</span>
					</div>

					<div className="list-columns">
						<div className="list-column">
							<h3>{t.lists.officialLists}</h3>
							{workspace?.lists.length ? (
								workspace.lists.map((list) => (
									<div className="list-chip" key={list.githubListId}>
										<strong>{list.name}</strong>
										<span>{list.description || t.lists.noDescription}</span>
									</div>
								))
							) : (
								<p className="empty-state">{t.lists.importEmpty}</p>
							)}
						</div>

						<div className="list-column stretch">
							<h3>{t.lists.desiredStateEditor}</h3>
							<div className="workspace-table">
								{workspace?.repositories.map((repository) => (
									<div className="workspace-row" key={repository.githubRepoId}>
										<div>
											<strong>{repository.fullName}</strong>
											<p>{repository.description || t.lists.noDescription}</p>
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
							<h3>{t.lists.diff}</h3>
							<div className="diff-stack">
								{workspace?.diff.additions.map((item) => (
									<div className="diff-card add" key={`add-${item.githubRepoId}-${item.githubListId}`}>
										<strong>{t.lists.add}</strong>
										<span>{item.fullName} → {item.listName}</span>
										<small>{item.reason}</small>
									</div>
								))}
								{workspace?.diff.removals.map((item) => (
									<div className="diff-card remove" key={`remove-${item.githubRepoId}-${item.githubListId}`}>
										<strong>{t.lists.remove}</strong>
										<span>{item.fullName} → {item.listName}</span>
									</div>
								))}
								{workspace &&
									workspace.diff.additions.length === 0 &&
									workspace.diff.removals.length === 0 && (
										<p className="empty-state">{t.lists.diffEmpty}</p>
									)}
							</div>
						</div>

						<div>
							<h3>{t.lists.bulkCandidates}</h3>
							<div className="diff-stack">
								{workspace?.bulkCandidates.map((candidate) => (
									<div className="diff-card" key={candidate.githubListId}>
										<strong>{candidate.listName}</strong>
										<span>{candidate.repositoryNames.join(", ")}</span>
										<small>{candidate.reason}</small>
									</div>
								))}
								{workspace?.bulkCandidates.length === 0 && (
									<p className="empty-state">{t.lists.bulkEmpty}</p>
								)}
							</div>
						</div>

						<div>
							<h3>{t.lists.queue}</h3>
							<div className="diff-stack">
								{workspace?.queue.map((item) => (
									<div className="diff-card" key={item.id}>
										<strong>{item.actionType === "add" ? t.lists.add : t.lists.remove}</strong>
										<span>{item.fullName} → {item.listName}</span>
										<small>{item.state}</small>
									</div>
								))}
								{workspace?.queue.length === 0 && (
									<p className="empty-state">{t.lists.queueEmpty}</p>
								)}
							</div>
						</div>
					</div>
				</div>
			</section>

			<section className="panel">
				<div className="panel-header">
					<h2>{t.history.title}</h2>
					<p>{t.history.description}</p>
				</div>
				<div className="history-grid">
					{dashboard?.syncRuns.length ? (
						dashboard.syncRuns.map((run) => (
							<div className="history-card" key={run.id}>
								<strong>{run.kind}</strong>
								<span>{run.target}</span>
								<small>{run.status}</small>
								<p>{run.message || t.history.noMessage}</p>
							</div>
						))
					) : (
						<p className="empty-state">{t.history.empty}</p>
					)}
				</div>
			</section>
		</div>
	);
}

function statusToText(status: StatusState, translation: (typeof copy)["en"]) {
	switch (status.key) {
		case "loading":
			return translation.statusMessages.loading;
		case "awaitingAuth":
			return translation.statusMessages.awaitingAuth;
		case "workspaceLoaded":
			return translation.statusMessages.workspaceLoaded;
		case "receivedImport":
			return translation.statusMessages.receivedImport;
		case "refreshingStargazers":
			return translation.statusMessages.refreshingStargazers;
		case "showingStargazers":
			return translation.statusMessages.showingStargazers(status.count);
		case "trackingRepository":
			return translation.statusMessages.trackingRepository(status.fullName);
		case "syncingStargazers":
			return translation.statusMessages.syncingStargazers;
		case "updatedUser":
			return translation.statusMessages.updatedUser(status.login);
		case "importingLists":
			return translation.statusMessages.importingLists;
		case "savingDesiredState":
			return translation.statusMessages.savingDesiredState;
		case "desiredStateSaved":
			return translation.statusMessages.desiredStateSaved;
		case "recomputingQueue":
			return translation.statusMessages.recomputingQueue;
		case "queueRecomputed":
			return translation.statusMessages.queueRecomputed;
		case "bookmarkletCopied":
			return translation.statusMessages.bookmarkletCopied;
	}
}

function formatDate(value: string, language: Language) {
	return new Intl.DateTimeFormat(language === "ja" ? "ja-JP" : "en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function safeStorageGet(key: string) {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeStorageSet(key: string, value: string) {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(key, value);
	} catch {
		// ignore storage failures in private mode or blocked storage environments
	}
}
