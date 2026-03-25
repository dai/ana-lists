import { describe, expect, it } from "vitest";

import {
	buildWorkspaceDiff,
	computeBulkCandidates,
	type DesiredAssignment,
	type ImportedList,
	type ImportedRepository,
	type ImportedRepositoryMembership,
} from "../src/domain/lists-workspace";

const repositories: ImportedRepository[] = [
	{ githubRepoId: 10, fullName: "owner/worker-app", description: "Worker app" },
	{ githubRepoId: 11, fullName: "owner/react-spa", description: "React SPA" },
	{ githubRepoId: 12, fullName: "owner/design-kit", description: "Design kit" },
];

const lists: ImportedList[] = [
	{ githubListId: "l1", name: "Cloudflare", description: "Runtime picks" },
	{ githubListId: "l2", name: "Frontend", description: "UI picks" },
];

const memberships: ImportedRepositoryMembership[] = [
	{ githubRepoId: 10, githubListId: "l1" },
	{ githubRepoId: 11, githubListId: "l1" },
];

describe("buildWorkspaceDiff", () => {
	it("detects additions and removals between GitHub state and desired assignments", () => {
		const desired: DesiredAssignment[] = [
			{ githubRepoId: 10, githubListId: "l1", reason: "already curated" },
			{ githubRepoId: 12, githubListId: "l1", reason: "Cloudflare adjacent" },
			{ githubRepoId: 11, githubListId: "l2", reason: "frontend bucket" },
		];

		const diff = buildWorkspaceDiff({ repositories, lists, memberships, desired });

		expect(diff.additions).toEqual([
			{
				githubRepoId: 12,
				githubListId: "l1",
				fullName: "owner/design-kit",
				listName: "Cloudflare",
				reason: "Cloudflare adjacent",
			},
			{
				githubRepoId: 11,
				githubListId: "l2",
				fullName: "owner/react-spa",
				listName: "Frontend",
				reason: "frontend bucket",
			},
		]);
		expect(diff.removals).toEqual([
			{
				githubRepoId: 11,
				githubListId: "l1",
				fullName: "owner/react-spa",
				listName: "Cloudflare",
			},
		]);
	});
});

describe("computeBulkCandidates", () => {
	it("groups repositories into candidate actions based on tags or notes", () => {
		const result = computeBulkCandidates({
			repositories,
			lists,
			memberships,
			annotations: [
				{ githubRepoId: 10, labels: ["cloudflare", "worker"] },
				{ githubRepoId: 12, labels: ["frontend", "design"] },
				{ githubRepoId: 11, labels: ["frontend", "react"] },
			],
		});

		expect(result).toEqual([
			{
				githubListId: "l1",
				listName: "Cloudflare",
				githubRepoIds: [10],
				repositoryNames: ["owner/worker-app"],
				reason: "Matched list name or description keywords",
			},
			{
				githubListId: "l2",
				listName: "Frontend",
				githubRepoIds: [11, 12],
				repositoryNames: ["owner/react-spa", "owner/design-kit"],
				reason: "Matched list name or description keywords",
			},
		]);
	});
});
