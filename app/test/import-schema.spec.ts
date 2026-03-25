import { describe, expect, it } from "vitest";

import { parseGithubStarsImport } from "../src/domain/import-schema";

describe("parseGithubStarsImport", () => {
	it("accepts a normalized GitHub stars/lists payload", () => {
		const payload = {
			exportedAt: "2026-03-25T00:00:00.000Z",
			stars: [
				{
					githubRepoId: 10,
					fullName: "owner/worker-app",
					description: "Worker app",
					url: "https://github.com/owner/worker-app",
					lists: [{ githubListId: "l1", name: "Cloudflare" }],
				},
			],
			lists: [
				{ githubListId: "l1", name: "Cloudflare", description: "Runtime picks" },
			],
		};

		expect(parseGithubStarsImport(payload)).toEqual({
			exportedAt: "2026-03-25T00:00:00.000Z",
			lists: [
				{ description: "Runtime picks", githubListId: "l1", name: "Cloudflare" },
			],
			memberships: [{ githubListId: "l1", githubRepoId: 10 }],
			stars: [
				{
					description: "Worker app",
					fullName: "owner/worker-app",
					githubRepoId: 10,
					url: "https://github.com/owner/worker-app",
				},
			],
		});
	});

	it("rejects malformed payloads", () => {
		expect(() =>
			parseGithubStarsImport({
				exportedAt: "not-a-date",
				stars: [],
				lists: [],
			}),
		).toThrow(/exportedAt/i);
	});
});
