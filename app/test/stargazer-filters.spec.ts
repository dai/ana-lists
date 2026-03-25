import { describe, expect, it } from "vitest";

import {
	filterStargazers,
	type StargazerRecord,
} from "../src/domain/stargazers";

const records: StargazerRecord[] = [
	{
		githubUserId: 1,
		login: "octocat",
		name: "The Octocat",
		bio: "Builds platform tools",
		company: "GitHub",
		followers: 20,
		publicRepos: 8,
		starredAt: "2026-03-01T10:00:00.000Z",
		repositoryIds: [100],
		tags: ["maintainer"],
		saved: true,
		note: "High-signal profile",
	},
	{
		githubUserId: 2,
		login: "infrafox",
		name: "Infra Fox",
		bio: "Distributed systems and workers",
		company: "Cloudflare",
		followers: 5,
		publicRepos: 18,
		starredAt: "2026-03-02T10:00:00.000Z",
		repositoryIds: [100, 200],
		tags: ["infra"],
		saved: false,
		note: "",
	},
	{
		githubUserId: 3,
		login: "designbird",
		name: "Design Bird",
		bio: "Design systems and frontend",
		company: "Independent",
		followers: 45,
		publicRepos: 4,
		starredAt: "2026-03-04T10:00:00.000Z",
		repositoryIds: [300],
		tags: ["frontend", "saved"],
		saved: true,
		note: "Follow for UI references",
	},
];

describe("filterStargazers", () => {
	it("filters across text, repository, saved state, tags, and follower threshold", () => {
		const result = filterStargazers(records, {
			query: "git",
			repositoryId: 100,
			savedOnly: true,
			tag: "maintainer",
			minFollowers: 10,
		});

		expect(result.map((item) => item.login)).toEqual(["octocat"]);
	});

	it("returns every record when no filters are active", () => {
		expect(filterStargazers(records, {}).map((item) => item.login)).toEqual([
			"octocat",
			"infrafox",
			"designbird",
		]);
	});
});
