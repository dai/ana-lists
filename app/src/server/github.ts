import type { StargazerRecord } from "../domain/stargazers";

type GithubUserProfile = {
	id: number;
	login: string;
	name: string | null;
	bio: string | null;
	company: string | null;
	followers: number;
	public_repos: number;
	avatar_url: string;
	html_url: string;
};

type GithubRepoDetails = {
	description: string | null;
};

type GithubStarEdge = {
	starred_at: string;
	user: {
		id: number;
		login: string;
		avatar_url: string;
		html_url: string;
	};
};

export async function fetchRepositoryDetails(
	fullName: string,
	token?: string,
): Promise<{ description: string }> {
	const response = await githubRequest(`https://api.github.com/repos/${fullName}`, token);
	const payload = (await response.json()) as GithubRepoDetails;

	return { description: payload.description ?? "" };
}

export async function fetchRepositoryStargazers(
	fullName: string,
	token?: string,
): Promise<StargazerRecord[]> {
	const starEdges: GithubStarEdge[] = [];
	let page = 1;

	while (true) {
		const response = await githubRequest(
			`https://api.github.com/repos/${fullName}/stargazers?per_page=100&page=${page}`,
			token,
			"application/vnd.github.star+json",
		);

		const payload = (await response.json()) as GithubStarEdge[];

		if (payload.length === 0) {
			break;
		}

		starEdges.push(...payload);
		page += 1;
	}

	const profiles = await mapWithConcurrency(starEdges, 8, async (edge) => {
		const response = await githubRequest(
			`https://api.github.com/users/${edge.user.login}`,
			token,
		);
		const profile = (await response.json()) as GithubUserProfile;

		return {
			githubUserId: edge.user.id,
			login: edge.user.login,
			name: profile.name ?? "",
			bio: profile.bio ?? "",
			company: profile.company ?? "",
			followers: profile.followers ?? 0,
			publicRepos: profile.public_repos ?? 0,
			starredAt: edge.starred_at,
			repositoryIds: [],
			tags: [],
			saved: false,
			note: "",
		} satisfies StargazerRecord;
	});

	return profiles;
}

export async function exchangeGithubCodeForSession(code: string, env: {
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	APP_ORIGIN?: string;
}) {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		throw new Error("GitHub OAuth is not configured");
	}

	const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "github-star-lists-crm",
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: `${env.APP_ORIGIN ?? ""}/api/auth/github/callback`,
		}),
	});

	if (!tokenResponse.ok) {
		throw new Error(`GitHub token exchange failed with ${tokenResponse.status}`);
	}

	const tokenPayload = (await tokenResponse.json()) as {
		access_token?: string;
		error?: string;
		error_description?: string;
	};

	if (!tokenPayload.access_token) {
		throw new Error(tokenPayload.error_description ?? tokenPayload.error ?? "Missing access token");
	}

	const userResponse = await githubRequest(
		"https://api.github.com/user",
		tokenPayload.access_token,
	);

	const userPayload = (await userResponse.json()) as GithubUserProfile;

	return {
		accessToken: tokenPayload.access_token,
		profile: {
			githubUserId: userPayload.id,
			githubLogin: userPayload.login,
			name: userPayload.name ?? userPayload.login,
			avatarUrl: userPayload.avatar_url,
		},
	};
}

function githubRequest(url: string, token?: string, accept = "application/json") {
	return fetch(url, {
		headers: {
			Accept: accept,
			"User-Agent": "github-star-lists-crm",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			"X-GitHub-Api-Version": "2022-11-28",
		},
	}).then((response) => {
		if (!response.ok) {
			throw new Error(`GitHub request failed (${response.status}) for ${url}`);
		}

		return response;
	});
}

async function mapWithConcurrency<T, R>(
	items: T[],
	concurrency: number,
	mapper: (item: T) => Promise<R>,
) {
	const results: R[] = [];
	let currentIndex = 0;

	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (currentIndex < items.length) {
				const item = items[currentIndex];
				currentIndex += 1;
				results.push(await mapper(item));
			}
		}),
	);

	return results;
}
