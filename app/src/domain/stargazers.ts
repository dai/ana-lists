export type StargazerRecord = {
	githubUserId: number;
	login: string;
	name: string;
	bio: string;
	company: string;
	followers: number;
	publicRepos: number;
	starredAt: string;
	repositoryIds: number[];
	tags: string[];
	saved: boolean;
	note: string;
};

export type StargazerFilters = {
	query?: string;
	repositoryId?: number;
	savedOnly?: boolean;
	tag?: string;
	minFollowers?: number;
	maxFollowers?: number;
	minPublicRepos?: number;
	maxPublicRepos?: number;
};

export function filterStargazers<T extends StargazerRecord>(
	records: T[],
	filters: StargazerFilters,
): T[] {
	const query = filters.query?.trim().toLowerCase();

	return records.filter((record) => {
		if (
			query &&
			![record.login, record.name, record.bio, record.company, record.note]
				.filter(Boolean)
				.some((value) => value.toLowerCase().includes(query))
		) {
			return false;
		}

		if (
			filters.repositoryId !== undefined &&
			!record.repositoryIds.includes(filters.repositoryId)
		) {
			return false;
		}

		if (filters.savedOnly && !record.saved) {
			return false;
		}

		if (filters.tag && !record.tags.includes(filters.tag)) {
			return false;
		}

		if (
			filters.minFollowers !== undefined &&
			record.followers < filters.minFollowers
		) {
			return false;
		}

		if (
			filters.maxFollowers !== undefined &&
			record.followers > filters.maxFollowers
		) {
			return false;
		}

		if (
			filters.minPublicRepos !== undefined &&
			record.publicRepos < filters.minPublicRepos
		) {
			return false;
		}

		if (
			filters.maxPublicRepos !== undefined &&
			record.publicRepos > filters.maxPublicRepos
		) {
			return false;
		}

		return true;
	});
}
