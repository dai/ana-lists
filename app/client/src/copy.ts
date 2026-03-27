import type { Language, Theme } from "./ui-preferences";

type CopyShape = {
	controls: {
		language: string;
		theme: string;
		logout: string;
		profile: string;
		settings: string;
		dashboard: string;
		githubProfile: string;
		githubAuth: string;
		openUserMenu: string;
	};
	languageOptions: Record<Language, string>;
	themeOptions: Record<Theme, string>;
	hero: {
		eyebrow: string;
		title: string;
		description: string;
	};
	statusCard: {
		status: string;
		user: string;
		listLimit: string;
		anonymous: string;
	};
	profilePage: {
		title: string;
		description: string;
		name: string;
		login: string;
		authMode: string;
		githubProfile: string;
		signedOut: string;
		authModeLabels: {
			anonymous: string;
			session: string;
			selfOnly: string;
		};
	};
	settingsPage: {
		title: string;
		description: string;
		appearance: string;
		auth: string;
		signedInAs: string;
		signedOut: string;
		authHint: string;
	};
	trackedRepos: {
		title: string;
		description: string;
		placeholder: string;
		action: string;
		empty: string;
		noDescription: string;
		synced: string;
		lastSync: string;
		syncAction: string;
	};
	authImport: {
		title: string;
		description: string;
		signedInAs: string;
		connectGithub: string;
		selfOnlyHint: string;
		copyBookmarklet: string;
		helper: string;
		importPlaceholder: string;
		importAction: string;
	};
	stargazers: {
		title: string;
		description: string;
		searchPlaceholder: string;
		allTrackedRepos: string;
		tagPlaceholder: string;
		minFollowersPlaceholder: string;
		savedOnly: string;
		applyFilters: string;
		noResults: string;
		noName: string;
		editNotes: string;
		saving: string;
		noBio: string;
		independent: string;
		followers: string;
		repos: string;
		noTags: string;
		saved: string;
		noNote: string;
		seenIn: string;
		promptTags: string;
		promptNote: string;
		promptSaved: string;
	};
	lists: {
		title: string;
		description: string;
		saveDesiredState: string;
		recomputeQueue: string;
		lastImport: string;
		never: string;
		officialLists: string;
		importEmpty: string;
		desiredStateEditor: string;
		noDescription: string;
		diff: string;
		bulkCandidates: string;
		queue: string;
		diffEmpty: string;
		bulkEmpty: string;
		queueEmpty: string;
		add: string;
		remove: string;
	};
	history: {
		title: string;
		description: string;
		empty: string;
		noMessage: string;
	};
	statusMessages: {
		loading: string;
		awaitingAuth: string;
		workspaceLoaded: string;
		receivedImport: string;
		refreshingStargazers: string;
		showingStargazers: (count: number) => string;
		trackingRepository: (fullName: string) => string;
		syncingStargazers: string;
		updatedUser: (login: string) => string;
		importingLists: string;
		savingDesiredState: string;
		desiredStateSaved: string;
		recomputingQueue: string;
		queueRecomputed: string;
		bookmarkletCopied: string;
	};
};

export const copy: Record<Language, CopyShape> = {
	en: {
		controls: {
			language: "Language",
			theme: "Theme",
			logout: "Log out",
			profile: "Profile",
			settings: "Settings",
			dashboard: "Back to dashboard",
			githubProfile: "GitHub profile",
			githubAuth: "GitHub Auth",
			openUserMenu: "Open user menu",
		},
		languageOptions: {
			en: "EN",
			ja: "日本語",
		},
		themeOptions: {
			light: "Light",
			dark: "Dark",
		},
		hero: {
			eyebrow: "Private CRM for GitHub signals",
			title: "Ana-Lists",
			description: "Manage and analyze your GitHub Lists.",
		},
		statusCard: {
			status: "Status",
			user: "User",
			listLimit: "List limit",
			anonymous: "Anonymous",
		},
		profilePage: {
			title: "Profile",
			description: "Review the current GitHub identity tied to this workspace and jump to the public profile when needed.",
			name: "Name",
			login: "Login",
			authMode: "Auth mode",
			githubProfile: "Open GitHub profile",
			signedOut: "Sign in with GitHub to view the linked profile details here.",
			authModeLabels: {
				anonymous: "Anonymous",
				session: "GitHub session",
				selfOnly: "Self-only mode",
			},
		},
		settingsPage: {
			title: "Settings",
			description: "Keep the interface compact and adjust the workspace appearance from one place.",
			appearance: "Appearance",
			auth: "Authentication",
			signedInAs: "Signed in as",
			signedOut: "Not signed in",
			authHint: "GitHub OAuth is unavailable. Self-only mode guidance remains below.",
		},
		trackedRepos: {
			title: "Tracked Repos",
			description: "Register any public repository and sync its stargazers manually.",
			placeholder: "owner/repository",
			action: "Track repo",
			empty: "No tracked repositories yet.",
			noDescription: "No repository description yet.",
			synced: "stargazers synced",
			lastSync: "last sync",
			syncAction: "Sync stargazers",
		},
		authImport: {
			title: "Auth + Import",
			description:
				"Self-only mode works immediately. OAuth is available when GitHub credentials are configured.",
			signedInAs: "Signed in as",
			connectGithub: "GitHub Auth",
			selfOnlyHint:
				"Set SELF_ONLY_GITHUB_LOGIN for self-only mode or configure GitHub OAuth env vars.",
			copyBookmarklet: "Copy import bookmarklet",
			helper:
				"Open your app first, then run the bookmarklet on GitHub's stars page or a GitHub List page. The helper sends a best-effort payload into this workspace.",
			importPlaceholder: "Paste import JSON here if you want a manual fallback.",
			importAction: "Import pasted JSON",
		},
		stargazers: {
			title: "Stargazer Explorer",
			description:
				"Search across tracked repositories and keep private annotations on interesting people.",
			searchPlaceholder: "Search login, bio, company, note",
			allTrackedRepos: "All tracked repos",
			tagPlaceholder: "Tag",
			minFollowersPlaceholder: "Min followers",
			savedOnly: "Saved only",
			applyFilters: "Apply filters",
			noResults: "No stargazers to show. Track and sync a repository first.",
			noName: "No display name",
			editNotes: "Edit notes",
			saving: "Saving...",
			noBio: "No bio available.",
			independent: "Independent",
			followers: "followers",
			repos: "repos",
			noTags: "No tags",
			saved: "Saved",
			noNote: "No private note yet.",
			seenIn: "Seen in",
			promptTags: "Comma-separated tags",
			promptNote: "Private note",
			promptSaved: "Mark this stargazer as saved?",
		},
		lists: {
			title: "Lists Workspace",
			description:
				"Review the current GitHub state, edit the desired state, and build a review queue.",
			saveDesiredState: "Save desired state",
			recomputeQueue: "Recompute queue",
			lastImport: "Last import",
			never: "never",
			officialLists: "Official Lists",
			importEmpty: "Import GitHub Lists to populate this workspace.",
			desiredStateEditor: "Desired state editor",
			noDescription: "No description",
			diff: "Diff",
			bulkCandidates: "Bulk candidates",
			queue: "Queue",
			diffEmpty: "No diff. Current GitHub state already matches the desired plan.",
			bulkEmpty: "No automatic bulk suggestions yet.",
			queueEmpty: "Run “Recompute queue” to capture the current diff as review items.",
			add: "Add",
			remove: "Remove",
		},
		history: {
			title: "Sync history",
			description: "Manual syncs and imports are tracked so you can see what changed and when.",
			empty: "No sync history yet.",
			noMessage: "No extra message",
		},
		statusMessages: {
			loading: "Loading workspace...",
			awaitingAuth: "Awaiting authentication",
			workspaceLoaded: "Workspace loaded",
			receivedImport: "Received import payload from GitHub helper...",
			refreshingStargazers: "Refreshing stargazers...",
			showingStargazers: (count) => `Showing ${count} stargazers`,
			trackingRepository: (fullName) => `Tracking ${fullName}...`,
			syncingStargazers: "Syncing stargazers from GitHub...",
			updatedUser: (login) => `Updated ${login}`,
			importingLists: "Importing GitHub stars and lists...",
			savingDesiredState: "Saving desired list plan...",
			desiredStateSaved: "Desired list plan saved",
			recomputingQueue: "Recomputing queue...",
			queueRecomputed: "Queue recomputed",
			bookmarkletCopied: "Bookmarklet copied to clipboard",
		},
	},
	ja: {
		controls: {
			language: "言語",
			theme: "表示",
			logout: "ログアウト",
			profile: "プロフィール",
			settings: "設定",
			dashboard: "ダッシュボードへ戻る",
			githubProfile: "GitHubプロフィール",
			githubAuth: "GitHub Auth",
			openUserMenu: "ユーザーメニューを開く",
		},
		languageOptions: {
			en: "EN",
			ja: "日本語",
		},
		themeOptions: {
			light: "ライト",
			dark: "ダーク",
		},
		hero: {
			eyebrow: "GitHub シグナルのための Private CRM",
			title: "Ana-Lists",
			description: "GitHub Lists を整理し、分析する。",
		},
		statusCard: {
			status: "状態",
			user: "ユーザー",
			listLimit: "List 上限",
			anonymous: "未ログイン",
		},
		profilePage: {
			title: "プロフィール",
			description: "このワークスペースに紐づく GitHub アカウント情報を確認し、必要なら公開プロフィールへ移動できます。",
			name: "表示名",
			login: "Login",
			authMode: "認証方式",
			githubProfile: "GitHubプロフィールを開く",
			signedOut: "GitHub でログインすると、ここに紐づくプロフィール情報を表示します。",
			authModeLabels: {
				anonymous: "未ログイン",
				session: "GitHub セッション",
				selfOnly: "self-only mode",
			},
		},
		settingsPage: {
			title: "設定",
			description: "一覧性を保ちながら、表示設定と認証導線をここでまとめて管理します。",
			appearance: "表示設定",
			auth: "認証",
			signedInAs: "ログイン中",
			signedOut: "未ログイン",
			authHint: "GitHub OAuth は未設定です。self-only mode の案内を下に表示します。",
		},
		trackedRepos: {
			title: "追跡中リポジトリ",
			description: "公開 repo を登録して、stargazer を手動で同期します。",
			placeholder: "owner/repository",
			action: "repo を追跡",
			empty: "まだ追跡中の repo はありません。",
			noDescription: "リポジトリ説明はまだありません。",
			synced: "人の stargazer を同期済み",
			lastSync: "最終同期",
			syncAction: "stargazer を同期",
		},
		authImport: {
			title: "認証 / 取り込み",
			description:
				"self-only mode ですぐ使えます。GitHub 認証情報があれば OAuth も有効です。",
			signedInAs: "ログイン中",
			connectGithub: "GitHub Auth",
			selfOnlyHint:
				"self-only mode を使うなら SELF_ONLY_GITHUB_LOGIN を設定し、OAuth を使うなら GitHub の環境変数を設定してください。",
			copyBookmarklet: "import bookmarklet をコピー",
			helper:
				"先にアプリを開き、その後 GitHub の stars ページか List ページで bookmarklet を実行してください。見えている内容を best-effort で取り込みます。",
			importPlaceholder: "手動 fallback 用に import JSON を貼り付けます。",
			importAction: "貼り付け JSON を取り込む",
		},
		stargazers: {
			title: "Stargazer Explorer",
			description: "追跡中 repo を横断して検索し、気になる人に非公開メモを残します。",
			searchPlaceholder: "login / bio / company / note を検索",
			allTrackedRepos: "すべての追跡 repo",
			tagPlaceholder: "タグ",
			minFollowersPlaceholder: "最小 followers",
			savedOnly: "保存済みのみ",
			applyFilters: "フィルター適用",
			noResults: "表示できる stargazer がありません。repo を追跡して同期してください。",
			noName: "表示名なし",
			editNotes: "メモ編集",
			saving: "保存中...",
			noBio: "bio はありません。",
			independent: "個人",
			followers: "followers",
			repos: "repos",
			noTags: "タグなし",
			saved: "保存済み",
			noNote: "非公開メモはまだありません。",
			seenIn: "確認元",
			promptTags: "カンマ区切りのタグ",
			promptNote: "非公開メモ",
			promptSaved: "この stargazer を保存済みにしますか？",
		},
		lists: {
			title: "Lists Workspace",
			description:
				"現在の GitHub 状態を見ながら desired state を編集し、review queue を作ります。",
			saveDesiredState: "desired state を保存",
			recomputeQueue: "queue を再計算",
			lastImport: "最終 import",
			never: "未実行",
			officialLists: "公式 Lists",
			importEmpty: "GitHub Lists を import するとここに表示されます。",
			desiredStateEditor: "desired state editor",
			noDescription: "説明なし",
			diff: "差分",
			bulkCandidates: "一括候補",
			queue: "Queue",
			diffEmpty: "差分はありません。現在の GitHub 状態と desired state が一致しています。",
			bulkEmpty: "自動の一括候補はまだありません。",
			queueEmpty: "「queue を再計算」を押すと差分が review item になります。",
			add: "追加",
			remove: "削除",
		},
		history: {
			title: "同期履歴",
			description: "手動同期と import の履歴を残して、いつ何をしたか確認できます。",
			empty: "まだ同期履歴はありません。",
			noMessage: "補足メッセージなし",
		},
		statusMessages: {
			loading: "ワークスペースを読み込み中...",
			awaitingAuth: "認証待ち",
			workspaceLoaded: "ワークスペースを読み込みました",
			receivedImport: "GitHub helper から import payload を受信しました...",
			refreshingStargazers: "stargazer を更新中...",
			showingStargazers: (count) => `${count} 件の stargazer を表示中`,
			trackingRepository: (fullName) => `${fullName} を追跡中...`,
			syncingStargazers: "GitHub から stargazer を同期中...",
			updatedUser: (login) => `${login} を更新しました`,
			importingLists: "GitHub stars / lists を取り込み中...",
			savingDesiredState: "desired list plan を保存中...",
			desiredStateSaved: "desired list plan を保存しました",
			recomputingQueue: "queue を再計算中...",
			queueRecomputed: "queue を再計算しました",
			bookmarkletCopied: "bookmarklet をコピーしました",
		},
	},
};
