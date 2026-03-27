import { startTransition, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { DesiredAssignment } from "../../src/domain/lists-workspace";
import type { AppUser, DashboardPayload, ListsWorkspaceView, StargazerView } from "../../src/shared/contracts";
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

type AppView = "dashboard" | "profile" | "settings";

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
	const [view, setView] = useState<AppView>("dashboard");
	const [menuOpen, setMenuOpen] = useState(false);
	const [stargazers, setStargazers] = useState<StargazerView[]>([]);
	const [filters, setFilters] = useState<FilterState>(initialFilters);
	const [trackInput, setTrackInput] = useState("");
	const [importText, setImportText] = useState("");
	const [status, setStatus] = useState<StatusState>({ key: "loading" });
	const [error, setError] = useState("");
	const [savingUserId, setSavingUserId] = useState<number | null>(null);
	const [desiredAssignments, setDesiredAssignments] = useState<DesiredAssignment[]>([]);
	const [highlightedRepoIds, setHighlightedRepoIds] = useState<Set<number>>(new Set());
	const profileMenuRef = useRef<HTMLDivElement | null>(null);

	const t = copy[language];
	const authUser = dashboard?.auth.user ?? null;
	const nextLanguage = language === "en" ? "ja" : "en";
	const nextTheme = theme === "light" ? "dark" : "light";
	const workspace = dashboard?.listsWorkspace;

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
			// Allow from any origin since bookmarklet runs on github.com but sends to our app
			if (event.data?.type !== "github-stars-import") {
				return;
			}
			const payload = event.data?.payload;
			if (!payload || !Array.isArray(payload.stars)) {
				console.error("[postMessage] invalid payload:", payload);
				return;
			}

			console.log("[postMessage] received import from", event.origin, payload);
			startTransition(() => {
				setStatus({ key: "receivedImport" });
				setView("dashboard");
			});

			void handleImport(payload);
		};

		window.addEventListener("message", handler);
		return () => window.removeEventListener("message", handler);
	}, []);

	useEffect(() => {
		if (!menuOpen) {
			return;
		}

		const handlePointerDown = (event: MouseEvent) => {
			if (!profileMenuRef.current?.contains(event.target as Node)) {
				setMenuOpen(false);
			}
		};

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [menuOpen]);

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

	async function handleTrackRepository(event: FormEvent<HTMLFormElement>) {
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
			console.log("[handleImport] importing", parsedPayload);

			// Capture imported repo IDs before reload
			const importedRepoIds = new Set<number>();
			for (const star of (parsedPayload as { stars?: { githubRepoId: number }[] }).stars ?? []) {
				importedRepoIds.add(star.githubRepoId);
			}

			await api.importLists(parsedPayload);
			setImportText("");
			await loadDashboard();

			// Highlight imported repos and fade out after 3s
			if (importedRepoIds.size > 0) {
				setHighlightedRepoIds(importedRepoIds);
				setTimeout(() => setHighlightedRepoIds(new Set()), 3000);
			}
			console.log("[handleImport] dashboard reloaded");
		} catch (caughtError) {
			console.error("[handleImport] error:", caughtError);
			setError(caughtError instanceof Error ? caughtError.message : "Failed to import GitHub lists");
		}
	}

	async function handleSaveDesiredAssignments() {
		try {
			setError("");
			setStatus({ key: "savingDesiredState" });
			const updatedWorkspace = await api.saveDesiredAssignments(desiredAssignments);
			updateWorkspace(updatedWorkspace);
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
			const updatedWorkspace = await api.recomputeQueue();
			updateWorkspace(updatedWorkspace);
			setStatus({ key: "queueRecomputed" });
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Failed to recompute queue");
		}
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
		setMenuOpen(false);
		startTransition(() => setView("dashboard"));
		await loadDashboard();
	}

	function updateWorkspace(updatedWorkspace: ListsWorkspaceView) {
		setDashboard((current) =>
			current
				? {
						...current,
						listsWorkspace: updatedWorkspace,
					}
				: current,
		);
		setDesiredAssignments(updatedWorkspace.desiredAssignments);
	}

	function toggleDesiredAssignment(githubRepoId: number, githubListId: string, enabled: boolean) {
		setDesiredAssignments((current) => {
			const withoutMatch = current.filter(
				(item) => !(item.githubRepoId === githubRepoId && item.githubListId === githubListId),
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

	function navigateTo(nextView: AppView) {
		setMenuOpen(false);
		startTransition(() => setView(nextView));
	}

	function renderUtilityProfileSlot() {
		if (authUser) {
			return (
				<div className="profile-menu-shell" data-testid="utility-profile" ref={profileMenuRef}>
					<button
						aria-expanded={menuOpen}
						aria-haspopup="menu"
						aria-label={t.controls.openUserMenu}
						className="avatar-button"
						data-testid="profile-menu-button"
						onClick={() => setMenuOpen((current) => !current)}
						type="button"
					>
						{authUser.avatarUrl ? (
							<img alt={authUser.githubLogin} className="avatar-image" src={authUser.avatarUrl} />
						) : (
							<span className="avatar-fallback" data-testid="avatar-fallback">
								{getInitials(authUser.name || authUser.githubLogin)}
							</span>
						)}
					</button>

					{menuOpen && (
						<div className="profile-menu" role="menu">
							<a
								className="menu-item"
								href={buildGithubProfileUrl(authUser.githubLogin)}
								rel="noreferrer"
								role="menuitem"
								target="_blank"
							>
								{t.controls.githubProfile}
							</a>
							<button className="menu-item" onClick={() => navigateTo("profile")} role="menuitem" type="button">
								{t.controls.profile}
							</button>
							<button className="menu-item" onClick={() => navigateTo("settings")} role="menuitem" type="button">
								{t.controls.settings}
							</button>
							<button className="menu-item danger" onClick={() => void handleLogout()} role="menuitem" type="button">
								{t.controls.logout}
							</button>
						</div>
					)}
				</div>
			);
		}

		return dashboard?.auth.githubConfigured ? (
			<a className="utility-auth-button" data-testid="github-auth-button" href="/api/auth/github/start">
				{t.controls.githubAuth}
			</a>
		) : (
			<button className="utility-auth-button is-disabled" data-testid="github-auth-button" disabled type="button">
				{t.controls.githubAuth}
			</button>
		);
	}

	function renderProfileView() {
		return (
			<section className="layout-grid profile-layout">
				<div className="panel profile-card">
					<div className="panel-header">
						<h2 className="section-title" data-testid="profile-page-title">
							{t.profilePage.title}
						</h2>
						<p>{t.profilePage.description}</p>
					</div>

					{authUser ? (
						<div className="profile-card-grid">
							<div className="profile-avatar-block">
								{authUser.avatarUrl ? (
									<img alt={authUser.githubLogin} className="profile-avatar" src={authUser.avatarUrl} />
								) : (
									<div className="profile-avatar fallback" data-testid="profile-avatar-fallback">
										{getInitials(authUser.name || authUser.githubLogin)}
									</div>
								)}
							</div>
							<div className="profile-metadata">
								<div className="info-row">
									<span>{t.profilePage.name}</span>
									<strong>{authUser.name}</strong>
								</div>
								<div className="info-row">
									<span>{t.profilePage.login}</span>
									<strong>@{authUser.githubLogin}</strong>
								</div>
								<div className="info-row">
									<span>{t.profilePage.authMode}</span>
									<strong>{authModeToText(authUser.authMode, t)}</strong>
								</div>
								<a
									className="primary-button inline-link"
									href={buildGithubProfileUrl(authUser.githubLogin)}
									rel="noreferrer"
									target="_blank"
								>
									{t.profilePage.githubProfile}
								</a>
							</div>
						</div>
					) : (
						<p className="empty-state">{t.profilePage.signedOut}</p>
					)}
				</div>
			</section>
		);
	}

	function renderSettingsView() {
		return (
			<section className="layout-grid profile-layout">
				<div className="panel">
					<div className="panel-header">
						<h2 className="section-title" data-testid="settings-page-title">
							{t.settingsPage.title}
						</h2>
						<p>{t.settingsPage.description}</p>
					</div>

					<div className="settings-grid">
						<div className="settings-card">
							<h3>{t.settingsPage.appearance}</h3>
							<div className="settings-stack">
								<div className="settings-row">
									<span>{t.controls.language}</span>
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
								<div className="settings-row">
									<span>{t.controls.theme}</span>
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
						</div>

						<div className="settings-card">
							<h3>{t.settingsPage.auth}</h3>
							<div className="settings-stack">
								<div className="info-row">
									<span>{authUser ? t.settingsPage.signedInAs : t.settingsPage.signedOut}</span>
									<strong>{authUser ? `@${authUser.githubLogin}` : t.statusCard.anonymous}</strong>
								</div>
								{authUser ? (
									<button className="ghost-button" onClick={() => void handleLogout()} type="button">
										{t.controls.logout}
									</button>
								) : dashboard?.auth.githubConfigured ? (
									<a className="primary-button inline-link" href="/api/auth/github/start">
										{t.controls.githubAuth}
									</a>
								) : (
									<>
										<p className="helper-copy">{t.settingsPage.authHint}</p>
										<p className="helper-copy">
											{t.authImport.selfOnlyHint.split("SELF_ONLY_GITHUB_LOGIN")[0]}
											<code>SELF_ONLY_GITHUB_LOGIN</code>
											{t.authImport.selfOnlyHint.split("SELF_ONLY_GITHUB_LOGIN")[1] ?? ""}
										</p>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</section>
		);
	}

	function renderDashboardView() {
		return (
			<>
				<section className="layout-grid">
					<div className="panel">
						<div className="panel-header">
							<h2 className="section-title">{t.trackedRepos.title}</h2>
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
											type="button"
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
							<h2 className="section-title">{t.authImport.title}</h2>
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

							<button className="secondary-button" onClick={() => void handleCopyBookmarklet()} type="button">
								{t.authImport.copyBookmarklet}
							</button>
							<p className="helper-copy">{t.authImport.helper}</p>
							<textarea
								className="import-area"
								value={importText}
								onChange={(event) => setImportText(event.target.value)}
								placeholder={t.authImport.importPlaceholder}
							/>
							<button className="primary-button" onClick={() => void handleImport()} type="button">
								{t.authImport.importAction}
							</button>
						</div>
					</div>
				</section>

				<section className="layout-grid wide">
					<div className="panel">
						<div className="panel-header">
							<h2 className="section-title">{t.stargazers.title}</h2>
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
							<button className="secondary-button" onClick={() => void applyFilters()} type="button">
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
												type="button"
											>
												{savingUserId === stargazer.githubUserId ? t.stargazers.saving : t.stargazers.editNotes}
											</button>
										</div>
										<p className="compact-copy">{stargazer.bio || t.stargazers.noBio}</p>
										<div className="metric-row">
											<span>{stargazer.company || t.stargazers.independent}</span>
											<span>
												{stargazer.followers} {t.stargazers.followers}
											</span>
											<span>
												{stargazer.publicRepos} {t.stargazers.repos}
											</span>
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
							<h2 className="section-title">{t.lists.title}</h2>
							<p>{t.lists.description}</p>
						</div>

						<div className="workspace-actions">
							<button className="secondary-button" onClick={() => void handleSaveDesiredAssignments()} type="button">
								{t.lists.saveDesiredState}
							</button>
							<button className="primary-button" onClick={() => void handleRecomputeQueue()} type="button">
								{t.lists.recomputeQueue}
							</button>
							<span
								className={`helper-copy import-timestamp${highlightedRepoIds.size > 0 ? " highlight" : ""}`}
								title={workspace?.lastImportedAt ? formatDate(workspace.lastImportedAt, language) : ""}
							>
								{t.lists.lastImport}
								{workspace?.lastImportedAt ? ` ${formatDate(workspace.lastImportedAt, language)}` : ` ${t.lists.never}`}
							</span>
						</div>

						{/* Spreadsheet-style matrix: rows=repos, columns=lists */}
						{workspace?.lists.length ? (
							<div className="matrix-wrapper">
								<table className="matrix-table">
									<thead>
										<tr>
											<th className="matrix-repo-header">リポジトリ</th>
											{workspace.lists.map((list) => (
												<th key={list.githubListId} className="matrix-list-header">
													<span className="matrix-list-name" title={list.description || list.name}>
														{list.name}
													</span>
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{workspace.repositories.map((repository) => (
											<tr
												key={repository.githubRepoId}
												className={highlightedRepoIds.has(repository.githubRepoId) ? "matrix-row-highlight" : ""}
											>
												<td className="matrix-repo-cell">
													<span className="matrix-repo-name" title={repository.description || ""}>
														{repository.fullName}
													</span>
												</td>
												{workspace.lists.map((list) => {
													const checked = desiredAssignments.some(
														(item) =>
															item.githubRepoId === repository.githubRepoId &&
															item.githubListId === list.githubListId,
													);
													return (
														<td key={list.githubListId} className="matrix-checkbox-cell">
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
																title={`${repository.fullName} → ${list.name}`}
															/>
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<p className="empty-state">{t.lists.importEmpty}</p>
						)}

						<div className="diff-grid">
							<div>
								<h3>{t.lists.diff}</h3>
								<div className="diff-stack">
									{workspace?.diff.additions.map((item) => (
										<div className="diff-card add" key={`add-${item.githubRepoId}-${item.githubListId}`}>
											<strong>{t.lists.add}</strong>
											<span>
												{item.fullName} → {item.listName}
											</span>
											<small>{item.reason}</small>
										</div>
									))}
									{workspace?.diff.removals.map((item) => (
										<div className="diff-card remove" key={`remove-${item.githubRepoId}-${item.githubListId}`}>
											<strong>{t.lists.remove}</strong>
											<span>
												{item.fullName} → {item.listName}
											</span>
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
											<span>
												{item.fullName} → {item.listName}
											</span>
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
						<h2 className="section-title">{t.history.title}</h2>
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
			</>
		);
	}

	return (
		<div className="app-shell">
			<header className="app-header">
				<div className="topbar">
					<div className="brand-cluster">
						<p className="eyebrow">{t.hero.eyebrow}</p>
						<button className="brand-button" onClick={() => navigateTo("dashboard")} type="button">
							<h1 className="brand-title" data-testid="brand-title">
								{t.hero.title}
							</h1>
						</button>
					</div>

					<div className="utility-bar" data-testid="utility-bar">
						<button
							aria-label={`${t.controls.language}: ${t.languageOptions[nextLanguage]}`}
							className="utility-button"
							data-testid="utility-language"
							onClick={() => setLanguage(nextLanguage)}
							type="button"
						>
							<span aria-hidden="true" className="utility-icon">
								<LanguageToggleIcon />
							</span>
							<span className="utility-value">{language.toUpperCase()}</span>
						</button>

						<button
							aria-label={`${t.controls.theme}: ${t.themeOptions[nextTheme]}`}
							className="utility-button"
							data-testid="utility-theme"
							onClick={() => setTheme(nextTheme)}
							type="button"
						>
							<span aria-hidden="true" className="utility-icon">
								<ThemeToggleIcon theme={theme} />
							</span>
							<span className="utility-value">{theme === "light" ? "L" : "D"}</span>
						</button>

						{renderUtilityProfileSlot()}
					</div>
				</div>

				<div className="hero">
					<div className="hero-panel">
						{view === "dashboard" ? (
							<p className="hero-copy">{t.hero.description}</p>
						) : (
							<div className="view-header">
								<button className="ghost-button compact-button" onClick={() => navigateTo("dashboard")} type="button">
									{t.controls.dashboard}
								</button>
								<div className="view-copy">
									<h2 className="section-title">
										{view === "profile" ? t.profilePage.title : t.settingsPage.title}
									</h2>
									<p className="hero-copy">
										{view === "profile" ? t.profilePage.description : t.settingsPage.description}
									</p>
								</div>
							</div>
						)}
					</div>

					<div className="status-panel">
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
					</div>
				</div>
			</header>

			{error && <div className="error-banner">{error}</div>}

			{view === "dashboard" && renderDashboardView()}
			{view === "profile" && renderProfileView()}
			{view === "settings" && renderSettingsView()}
		</div>
	);
}

function authModeToText(mode: AppUser["authMode"], translation: (typeof copy)["en"] | (typeof copy)["ja"]) {
	switch (mode) {
		case "session":
			return translation.profilePage.authModeLabels.session;
		case "self-only":
			return translation.profilePage.authModeLabels.selfOnly;
		default:
			return translation.profilePage.authModeLabels.anonymous;
	}
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

function buildGithubProfileUrl(login: string) {
	return `https://github.com/${login}`;
}

export function getInitials(value: string) {
	const parts = value
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	if (parts.length === 0) {
		return "GH";
	}

	return parts
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? "")
		.join("");
}

function LanguageToggleIcon() {
	return (
		<svg fill="none" height="18" viewBox="0 0 24 24" width="18">
			<rect height="18" rx="5" stroke="currentColor" strokeWidth="1.5" width="18" x="3" y="3" />
			<path
				d="M8 15.5L10.4 8.5H11.8L14.2 15.5"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.5"
			/>
			<path d="M9 13.2H13.2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
			<path
				d="M15.8 9.2C16.5 10.2 17.1 11 18 11.8C17.1 12.7 16.4 13.5 15.5 14.4"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="1.5"
			/>
		</svg>
	);
}

function ThemeToggleIcon({ theme }: { theme: Theme }) {
	return theme === "light" ? (
		<svg fill="none" height="18" viewBox="0 0 24 24" width="18">
			<circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
			<path
				d="M12 3.5V6M12 18V20.5M20.5 12H18M6 12H3.5M18.01 5.99L16.2 7.8M7.8 16.2L5.99 18.01M18.01 18.01L16.2 16.2M7.8 7.8L5.99 5.99"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.6"
			/>
		</svg>
	) : (
		<svg fill="none" height="18" viewBox="0 0 24 24" width="18">
			<path
				d="M14.5 3.5C11.1 4.3 8.5 7.35 8.5 11c0 4.28 3.47 7.75 7.75 7.75 1.61 0 3.11-.49 4.35-1.34-1.19 2.08-3.43 3.49-6 3.49-3.81 0-6.9-3.09-6.9-6.9 0-3.12 2.08-5.74 4.93-6.57.66-.19 1.29-.3 1.87-.33Z"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth="1.6"
			/>
		</svg>
	);
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
