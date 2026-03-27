import { act } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

const mockApi = vi.hoisted(() => ({
	getDashboard: vi.fn(),
	trackRepository: vi.fn(),
	syncRepository: vi.fn(),
	getStargazers: vi.fn(),
	saveAnnotation: vi.fn(),
	importLists: vi.fn(),
	saveDesiredAssignments: vi.fn(),
	recomputeQueue: vi.fn(),
	logout: vi.fn(),
}));

vi.mock("../client/src/api", () => ({
	api: mockApi,
}));

import { App } from "../client/src/App";

describe("App UI", () => {
	let root: Root | null = null;
	let container: HTMLDivElement | null = null;

	beforeAll(() => {
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: vi.fn().mockImplementation((query: string) => ({
				matches: false,
				media: query,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			})),
		});

		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: vi.fn(),
			},
		});
	});

	beforeEach(() => {
		mockApi.trackRepository.mockResolvedValue({});
		mockApi.syncRepository.mockResolvedValue({});
		mockApi.getStargazers.mockResolvedValue([]);
		mockApi.saveAnnotation.mockResolvedValue({ stargazers: [] });
		mockApi.importLists.mockResolvedValue({});
		mockApi.saveDesiredAssignments.mockResolvedValue(createDashboard().listsWorkspace);
		mockApi.recomputeQueue.mockResolvedValue(createDashboard().listsWorkspace);
		mockApi.logout.mockResolvedValue({ ok: true });
	});

	afterEach(async () => {
		if (root) {
			await act(async () => {
				root?.unmount();
			});
		}
		root = null;
		container = null;
		document.body.innerHTML = "";
		vi.clearAllMocks();
		window.localStorage.clear();
	});

	it("renders utility controls in the required order and opens profile/settings from the menu", async () => {
		await renderApp(createDashboard());

		const utilityBar = container?.querySelector('[data-testid="utility-bar"]');
		expect(utilityBar).toBeTruthy();

		const order = Array.from(utilityBar?.children ?? []).map((element) => element.getAttribute("data-testid"));
		expect(order).toEqual(["utility-language", "utility-theme", "utility-profile"]);

		const menuButton = container?.querySelector('[data-testid="profile-menu-button"]') as HTMLButtonElement;
		expect(menuButton).toBeTruthy();

		await click(menuButton);

		const githubProfileLink = container?.querySelector(".profile-menu a") as HTMLAnchorElement | null;
		expect(githubProfileLink?.getAttribute("href")).toBe("https://github.com/octocat");
		expect(githubProfileLink?.textContent).toContain("GitHub profile");
		expect(container?.textContent).toContain("Profile");
		expect(container?.textContent).toContain("Settings");
		expect(container?.textContent).toContain("Log out");

		const profileMenuItem = Array.from(container?.querySelectorAll(".menu-item") ?? []).find((element) =>
			element.textContent?.includes("Profile"),
		) as HTMLButtonElement | undefined;
		expect(profileMenuItem).toBeTruthy();

		await click(profileMenuItem!);
		expect(container?.querySelector('[data-testid="profile-page-title"]')?.textContent).toBe("Profile");

		const reopenedMenuButton = container?.querySelector('[data-testid="profile-menu-button"]') as HTMLButtonElement;
		await click(reopenedMenuButton);

		const settingsMenuItem = Array.from(container?.querySelectorAll(".menu-item") ?? []).find((element) =>
			element.textContent?.includes("Settings"),
		) as HTMLButtonElement | undefined;
		expect(settingsMenuItem).toBeTruthy();

		await click(settingsMenuItem!);
		expect(container?.querySelector('[data-testid="settings-page-title"]')?.textContent).toBe("Settings");
	});

	it("shows GitHub Auth in the right slot when signed out", async () => {
		await renderApp(
			createDashboard({
				auth: {
					authenticated: false,
					githubConfigured: true,
					user: null,
				},
			}),
		);

		expect(container?.querySelector('[data-testid="github-auth-button"]')?.textContent).toContain("GitHub Auth");
		expect(container?.querySelector('[data-testid="profile-menu-button"]')).toBeNull();
	});

	it("uses avatar fallback and keeps title styling separate from section headings", async () => {
		await renderApp(
			createDashboard({
				auth: {
					authenticated: true,
					githubConfigured: true,
					user: {
						id: 1,
						githubLogin: "self-hosted",
						name: "Self Hosted",
						avatarUrl: "",
						authMode: "self-only",
					},
				},
			}),
		);

		expect(container?.querySelector('[data-testid="avatar-fallback"]')?.textContent).toBe("SH");
		expect(container?.querySelector('[data-testid="brand-title"]')?.className).toContain("brand-title");
		expect(container?.querySelector(".section-title")?.className).toContain("section-title");
	});

	async function renderApp(payload = createDashboard()) {
		mockApi.getDashboard.mockResolvedValue(payload);
		document.body.innerHTML = "";
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(<App />);
		});

		await act(async () => {
			await Promise.resolve();
		});
	}
});

async function click(element: Element) {
	await act(async () => {
		element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		await Promise.resolve();
	});
}

function createDashboard(
	overrides: Partial<{
		auth: {
			user: {
				id: number;
				githubLogin: string;
				name: string;
				avatarUrl: string;
				authMode: "anonymous" | "session" | "self-only";
			} | null;
			githubConfigured: boolean;
			authenticated: boolean;
		};
	}> = {},
) {
	return {
		auth: overrides.auth ?? {
			authenticated: true,
			githubConfigured: true,
			user: {
				id: 1,
				githubLogin: "octocat",
				name: "The Octocat",
				avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
				authMode: "session" as const,
			},
		},
		trackedRepositories: [
			{
				id: 10,
				fullName: "openai/playground",
				owner: "openai",
				repo: "playground",
				description: "Workspace repo",
				lastSyncedAt: "2026-03-27T00:00:00.000Z",
				stargazerCount: 12,
			},
		],
		stargazers: [],
		listsWorkspace: {
			repositories: [],
			lists: [],
			desiredAssignments: [],
			diff: { additions: [], removals: [] },
			bulkCandidates: [],
			queue: [],
			lastImportedAt: null,
		},
		syncRuns: [],
		listLimit: 32,
		importHelper: {
			bookmarklet: "javascript:alert('noop')",
			origin: "http://localhost:8787",
		},
	};
}
