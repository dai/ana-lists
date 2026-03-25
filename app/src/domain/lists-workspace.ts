export type ImportedRepository = {
	githubRepoId: number;
	fullName: string;
	description: string;
};

export type ImportedList = {
	githubListId: string;
	name: string;
	description: string;
};

export type ImportedRepositoryMembership = {
	githubRepoId: number;
	githubListId: string;
};

export type DesiredAssignment = {
	githubRepoId: number;
	githubListId: string;
	reason: string;
};

export type RepositoryAnnotation = {
	githubRepoId: number;
	labels: string[];
};

type WorkspaceInput = {
	repositories: ImportedRepository[];
	lists: ImportedList[];
	memberships: ImportedRepositoryMembership[];
	desired: DesiredAssignment[];
};

type BulkCandidateInput = {
	repositories: ImportedRepository[];
	lists: ImportedList[];
	memberships: ImportedRepositoryMembership[];
	annotations: RepositoryAnnotation[];
};

export function buildWorkspaceDiff(input: WorkspaceInput) {
	const repositoryById = new Map(
		input.repositories.map((repository) => [repository.githubRepoId, repository]),
	);
	const listById = new Map(input.lists.map((list) => [list.githubListId, list]));

	const currentKeys = new Set(
		input.memberships.map((membership) =>
			membershipKey(membership.githubRepoId, membership.githubListId),
		),
	);
	const desiredKeys = new Set(
		input.desired.map((assignment) =>
			membershipKey(assignment.githubRepoId, assignment.githubListId),
		),
	);

	const additions = input.desired
		.filter(
			(assignment) =>
				!currentKeys.has(membershipKey(assignment.githubRepoId, assignment.githubListId)),
		)
		.map((assignment) => ({
			githubRepoId: assignment.githubRepoId,
			githubListId: assignment.githubListId,
			fullName: repositoryById.get(assignment.githubRepoId)?.fullName ?? "Unknown repository",
			listName: listById.get(assignment.githubListId)?.name ?? "Unknown list",
			reason: assignment.reason,
		}));

	const desiredByKey = new Map(
		input.desired.map((assignment) => [
			membershipKey(assignment.githubRepoId, assignment.githubListId),
			assignment,
		]),
	);

	const removals = input.memberships
		.filter(
			(membership) =>
				!desiredKeys.has(membershipKey(membership.githubRepoId, membership.githubListId)),
		)
		.map((membership) => ({
			githubRepoId: membership.githubRepoId,
			githubListId: membership.githubListId,
			fullName: repositoryById.get(membership.githubRepoId)?.fullName ?? "Unknown repository",
			listName: listById.get(membership.githubListId)?.name ?? "Unknown list",
			reason: desiredByKey.get(membershipKey(membership.githubRepoId, membership.githubListId))
				?.reason,
		}))
		.map(({ reason: _reason, ...removal }) => removal);

	return { additions, removals };
}

export function computeBulkCandidates(input: BulkCandidateInput) {
	const listKeywords = input.lists.map((list) => ({
		list,
		keywords: [list.name, list.description]
			.join(" ")
			.toLowerCase()
			.split(/[^a-z0-9]+/)
			.filter(Boolean),
	}));
	const repositoryById = new Map(
		input.repositories.map((repository) => [repository.githubRepoId, repository]),
	);
	const repositoryOrder = new Map(
		input.repositories.map((repository, index) => [repository.githubRepoId, index]),
	);

	return listKeywords
		.map(({ list, keywords }) => {
			const matchingRepositories = input.annotations
				.filter((annotation) => {
					const haystack = annotation.labels.map((label) => label.toLowerCase());
					return keywords.some((keyword) => haystack.includes(keyword));
				})
				.map((annotation) => repositoryById.get(annotation.githubRepoId))
				.filter((repository): repository is ImportedRepository => Boolean(repository))
				.sort(
					(left, right) =>
						(repositoryOrder.get(left.githubRepoId) ?? 0) -
						(repositoryOrder.get(right.githubRepoId) ?? 0),
				);

			if (matchingRepositories.length === 0) {
				return null;
			}

			return {
				githubListId: list.githubListId,
				listName: list.name,
				githubRepoIds: matchingRepositories.map((repository) => repository.githubRepoId),
				repositoryNames: matchingRepositories.map((repository) => repository.fullName),
				reason: "Matched list name or description keywords",
			};
		})
		.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
}

function membershipKey(githubRepoId: number, githubListId: string) {
	return `${githubRepoId}:${githubListId}`;
}
