import { parseGithubStarsImport } from "../domain/import-schema";
import type { DesiredAssignment } from "../domain/lists-workspace";
import { fetchRepositoryDetails, fetchRepositoryStargazers, exchangeGithubCodeForSession } from "./github";
import {
	createExpiredSessionCookie,
	createSignedSessionCookie,
	verifySignedSessionCookie,
} from "./session";
import { D1Store } from "./store";
import type { DashboardPayload } from "../shared/contracts";

export type AppEnv = {
	ASSETS: Fetcher;
	DB: D1Database;
	APP_NAME?: string;
	APP_ORIGIN?: string;
	GITHUB_API_TOKEN?: string;
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	LIST_LIMIT?: string;
	SELF_ONLY_GITHUB_LOGIN?: string;
	SESSION_COOKIE_NAME?: string;
	SESSION_SECRET?: string;
};

export async function handleRequest(request: Request, env: AppEnv): Promise<Response> {
	const url = new URL(request.url);
	const store = new D1Store(env.DB);

	if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(request),
		});
	}

	if (url.pathname === "/api/auth/github/start" && request.method === "GET") {
		if (!env.GITHUB_CLIENT_ID) {
			return json({ error: "GitHub OAuth is not configured" }, 503);
		}

		const redirectUri = `${resolveAppOrigin(request, env)}/api/auth/github/callback`;
		const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
		authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
		authorizeUrl.searchParams.set("redirect_uri", redirectUri);
		authorizeUrl.searchParams.set("scope", "read:user");

		return Response.redirect(authorizeUrl.toString(), 302);
	}

	if (url.pathname === "/api/auth/github/callback") {
		if (request.method === "GET") {
			const code = url.searchParams.get("code");
			if (!code) {
				return Response.redirect(resolveAppOrigin(request, env), 302);
			}

			const session = await createSessionFromCode(code, request, env, store);
			return new Response(null, {
				status: 302,
				headers: {
					Location: resolveAppOrigin(request, env),
					"Set-Cookie": session.cookie,
				},
			});
		}

		if (request.method === "POST") {
			const body = await readJson<{ code?: string }>(request);
			if (!body.code) {
				return json({ error: "Missing GitHub OAuth code" }, 400);
			}

			const session = await createSessionFromCode(body.code, request, env, store);
			return json(
				{ user: session.user },
				200,
				new Headers({
					"Set-Cookie": session.cookie,
				}),
			);
		}
	}

	if (url.pathname === "/api/auth/logout" && request.method === "POST") {
		const sessionId = await verifySignedSessionCookie({
			cookieName: getCookieName(env),
			secret: getSessionSecret(env),
			request,
		});

		if (sessionId) {
			await store.deleteSession(sessionId);
		}

		return json(
			{ ok: true },
			200,
			new Headers({
				"Set-Cookie": createExpiredSessionCookie({
					cookieName: getCookieName(env),
					secure: isSecureRequest(request),
				}),
			}),
		);
	}

	if (url.pathname === "/api/auth/session" && request.method === "GET") {
		const auth = await resolveAuth(request, env, store);
		return json({
			user: auth.user,
			authenticated: Boolean(auth.user),
			githubConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
		});
	}

	if (url.pathname === "/api/bootstrap" && request.method === "GET") {
		const auth = await resolveAuth(request, env, store);
		return json(await buildDashboardPayload(request, env, store, auth.user));
	}

	if (url.pathname === "/api/repos" && request.method === "GET") {
		const user = await requireUser(request, env, store);
		return json(await store.listTrackedRepositories(user.id));
	}

	if (url.pathname === "/api/repos/track" && request.method === "POST") {
		const user = await requireUser(request, env, store);
		const body = await readJson<{ fullName?: string }>(request);

		if (!body.fullName || !/^[^/]+\/[^/]+$/.test(body.fullName)) {
			return json({ error: "Repository must be in owner/repo format" }, 400);
		}

		let description = "";
		try {
			description = (await fetchRepositoryDetails(body.fullName, await getGithubToken(request, env, store)))
				.description;
		} catch {
			description = "";
		}

		await store.trackRepository(user.id, body.fullName, description);
		return json({ repositories: await store.listTrackedRepositories(user.id) }, 201);
	}

	const syncMatch = url.pathname.match(/^\/api\/repos\/(\d+)\/sync-stargazers$/);
	if (syncMatch && request.method === "POST") {
		const user = await requireUser(request, env, store);
		const repositoryId = Number(syncMatch[1]);
		const repository = await store.getTrackedRepository(user.id, repositoryId);

		if (!repository) {
			return json({ error: "Tracked repository not found" }, 404);
		}

		const runId = await store.startSyncRun(user.id, "stargazers", repository.full_name);

		try {
			const token = await getGithubToken(request, env, store);
			const stargazers = await fetchRepositoryStargazers(repository.full_name, token);
			await store.replaceStargazers(user.id, repositoryId, stargazers);
			await store.finishSyncRun(runId, "success", `Synced ${stargazers.length} stargazers`);
			return json({
				trackedRepositories: await store.listTrackedRepositories(user.id),
				stargazers: await store.listStargazers(user.id, {}),
				syncRuns: await store.listSyncRuns(user.id),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown sync error";
			await store.finishSyncRun(runId, "failed", message);
			return json({ error: message }, 502);
		}
	}

	if (url.pathname === "/api/stargazers" && request.method === "GET") {
		const user = await requireUser(request, env, store);
		return json(
			await store.listStargazers(user.id, {
				query: url.searchParams.get("query") ?? undefined,
				repositoryId: parseOptionalNumber(url.searchParams.get("repositoryId")),
				savedOnly: url.searchParams.get("savedOnly") === "true",
				tag: url.searchParams.get("tag") ?? undefined,
				minFollowers: parseOptionalNumber(url.searchParams.get("minFollowers")),
				maxFollowers: parseOptionalNumber(url.searchParams.get("maxFollowers")),
			}),
		);
	}

	const annotationMatch = url.pathname.match(/^\/api\/stargazers\/(\d+)\/annotations$/);
	if (annotationMatch && request.method === "POST") {
		const user = await requireUser(request, env, store);
		const githubUserId = Number(annotationMatch[1]);
		const body = await readJson<{ tags?: string[]; note?: string; saved?: boolean }>(request);

		await store.upsertStargazerAnnotation(user.id, githubUserId, {
			tags: Array.isArray(body.tags) ? body.tags.filter((tag) => typeof tag === "string") : [],
			note: typeof body.note === "string" ? body.note : "",
			saved: Boolean(body.saved),
		});

		return json({ stargazers: await store.listStargazers(user.id, {}) });
	}

	if (url.pathname === "/api/import/github-stars-lists" && request.method === "POST") {
		const user = await requireUser(request, env, store);
		const runId = await store.startSyncRun(user.id, "lists-import", "github-stars");

		try {
			const parsed = parseGithubStarsImport(await readJson(request));
			await store.importGithubStarsAndLists(user.id, parsed);
			await store.finishSyncRun(runId, "success", `Imported ${parsed.stars.length} repositories`);
			return json({
				listsWorkspace: await store.getListsWorkspace(user.id),
				syncRuns: await store.listSyncRuns(user.id),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Invalid import payload";
			await store.finishSyncRun(runId, "failed", message);
			return json({ error: message }, 400);
		}
	}

	if (url.pathname === "/api/lists/workspace" && request.method === "GET") {
		const user = await requireUser(request, env, store);
		return json(await store.getListsWorkspace(user.id));
	}

	if (url.pathname === "/api/lists/desired-assignments" && request.method === "POST") {
		const user = await requireUser(request, env, store);
		const body = await readJson<{ assignments?: DesiredAssignment[] } | DesiredAssignment[]>(request);
		const assignments = Array.isArray(body) ? body : Array.isArray(body.assignments) ? body.assignments : [];
		await store.saveDesiredAssignments(user.id, assignments);
		return json(await store.getListsWorkspace(user.id));
	}

	if (url.pathname === "/api/lists/bulk-candidates/recompute" && request.method === "POST") {
		const user = await requireUser(request, env, store);
		const workspace = await store.getListsWorkspace(user.id);
		await store.replaceBulkQueue(user.id, workspace.diff);
		return json(await store.getListsWorkspace(user.id));
	}

	return serveAsset(request, env);
}

async function createSessionFromCode(code: string, request: Request, env: AppEnv, store: D1Store) {
	const githubSession = await exchangeGithubCodeForSession(code, {
		GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
		GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
		APP_ORIGIN: resolveAppOrigin(request, env),
	});
	const user = await store.ensureUser(
		{
			githubUserId: githubSession.profile.githubUserId,
			githubLogin: githubSession.profile.githubLogin,
			name: githubSession.profile.name,
			avatarUrl: githubSession.profile.avatarUrl,
		},
		"session",
	);

	if (!user) {
		throw new Error("Failed to create user");
	}

	const sessionId = await store.createSession(user.id, githubSession.accessToken);
	return {
		user,
		cookie: await createSignedSessionCookie({
			cookieName: getCookieName(env),
			secret: getSessionSecret(env),
			sessionId,
			secure: isSecureRequest(request),
		}),
	};
}

async function buildDashboardPayload(
	request: Request,
	env: AppEnv,
	store: D1Store,
	user: DashboardPayload["auth"]["user"],
): Promise<DashboardPayload> {
	if (!user) {
		return {
			auth: {
				user: null,
				githubConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
				authenticated: false,
			},
			trackedRepositories: [],
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
			listLimit: getListLimit(env),
			importHelper: {
				bookmarklet: buildImportHelper(resolveAppOrigin(request, env)),
				origin: resolveAppOrigin(request, env),
			},
		};
	}

	return {
		auth: {
			user,
			githubConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
			authenticated: true,
		},
		trackedRepositories: await store.listTrackedRepositories(user.id),
		stargazers: await store.listStargazers(user.id, {}),
		listsWorkspace: await store.getListsWorkspace(user.id),
		syncRuns: await store.listSyncRuns(user.id),
		listLimit: getListLimit(env),
		importHelper: {
			bookmarklet: buildImportHelper(resolveAppOrigin(request, env)),
			origin: resolveAppOrigin(request, env),
		},
	};
}

async function resolveAuth(request: Request, env: AppEnv, store: D1Store) {
	const selfOnlyLogin = env.SELF_ONLY_GITHUB_LOGIN?.trim();

	if (selfOnlyLogin) {
		const user = await store.ensureUser(
			{
				githubUserId: null,
				githubLogin: selfOnlyLogin,
				name: selfOnlyLogin,
				avatarUrl: "",
			},
			"self-only",
		);

		return { user };
	}

	const sessionId = await verifySignedSessionCookie({
		cookieName: getCookieName(env),
		secret: getSessionSecret(env),
		request,
	});

	if (!sessionId) {
		return { user: null };
	}

	const session = await store.getSession(sessionId, "session");
	return { user: session?.user ?? null };
}

async function requireUser(request: Request, env: AppEnv, store: D1Store) {
	const auth = await resolveAuth(request, env, store);

	if (!auth.user) {
		throw new HttpError(401, "Authentication required");
	}

	return auth.user;
}

async function getGithubToken(request: Request, env: AppEnv, store: D1Store) {
	if (env.GITHUB_API_TOKEN?.trim()) {
		return env.GITHUB_API_TOKEN.trim();
	}

	const sessionId = await verifySignedSessionCookie({
		cookieName: getCookieName(env),
		secret: getSessionSecret(env),
		request,
	});

	if (!sessionId) {
		return undefined;
	}

	const session = await store.getSession(sessionId, "session");
	return session?.accessToken ?? undefined;
}

async function serveAsset(request: Request, env: AppEnv) {
	if (!env.ASSETS) {
		return new Response("Assets binding is not configured", { status: 500 });
	}

	const assetResponse = await env.ASSETS.fetch(request);

	if (assetResponse.status !== 404) {
		return assetResponse;
	}

	const url = new URL(request.url);
	url.pathname = "/index.html";
	return env.ASSETS.fetch(new Request(url.toString(), request));
}

function json(payload: unknown, status = 200, headers = new Headers()) {
	headers.set("Content-Type", "application/json; charset=utf-8");
	return new Response(JSON.stringify(payload), { status, headers });
}

async function readJson<T>(request: Request): Promise<T> {
	return (await request.json()) as T;
}

function parseOptionalNumber(value: string | null) {
	if (!value) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function getListLimit(env: AppEnv) {
	return Number(env.LIST_LIMIT ?? "32");
}

function getCookieName(env: AppEnv) {
	return env.SESSION_COOKIE_NAME?.trim() || "gslcrm_session";
}

function getSessionSecret(env: AppEnv) {
	const secret = env.SESSION_SECRET?.trim();
	if (!secret) {
		throw new Error("SESSION_SECRET environment variable is required");
	}
	return secret;
}

function isSecureRequest(request: Request) {
	return new URL(request.url).protocol === "https:";
}

function resolveAppOrigin(request: Request, env: AppEnv) {
	return env.APP_ORIGIN?.trim() || new URL(request.url).origin;
}

function buildImportHelper(appOrigin: string) {
	const source = `
javascript:(async()=>{const appOrigin=${JSON.stringify(appOrigin)};const rows=[...document.querySelectorAll("article,li,div")];const currentList=((document.querySelector("h1, h2, [data-view-component='true']")?.textContent)||"").trim();const repos=[];const seen=new Set();for(const row of rows){const anchor=row.querySelector("a[href^='/'][href*='/']");if(!anchor)continue;const href=anchor.getAttribute("href")||"";const parts=href.split("/").filter(Boolean);if(parts.length<2)continue;const fullName=parts.slice(0,2).join("/");if(seen.has(fullName))continue;seen.add(fullName);const description=(row.querySelector("p")?.textContent||"").trim();repos.push({githubRepoId:Number.parseInt(String(Math.abs([...fullName].reduce((acc,ch)=>acc+ch.charCodeAt(0),0))),10),fullName,description,url:new URL(href,location.origin).toString(),lists:currentList?[{githubListId:currentList.toLowerCase().replace(/[^a-z0-9]+/g,"-"),name:currentList}]:[]});}const payload={exportedAt:new Date().toISOString(),stars:repos,lists:currentList?[{githubListId:currentList.toLowerCase().replace(/[^a-z0-9]+/g,"-"),name:currentList,description:"Imported from visible GitHub page"}]:[]};const receiver=window.open(appOrigin,"gslcrm-import");if(!receiver){alert("Open the app first, then run the helper again.");return;}const send=()=>receiver.postMessage({type:"github-stars-import",payload},appOrigin);send();setTimeout(send,750);setTimeout(send,1500);})();`;

	return source.replace(/\s+/g, " ");
}

function corsHeaders(request: Request) {
	return {
		"Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
	};
}

class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
	}
}

export async function handleApiRequest(request: Request, env: AppEnv) {
	try {
		return await handleRequest(request, env);
	} catch (error) {
		if (error instanceof HttpError) {
			return json({ error: error.message }, error.status);
		}

		return json(
			{ error: error instanceof Error ? error.message : "Unexpected server error" },
			500,
		);
	}
}
