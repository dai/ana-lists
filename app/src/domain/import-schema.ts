type RawImportList = {
	githubListId: string;
	name: string;
	description?: string;
};

type RawImportStar = {
	githubRepoId: number;
	fullName: string;
	description?: string;
	url: string;
	lists: RawImportList[];
};

type RawImportPayload = {
	exportedAt: string;
	stars: RawImportStar[];
	lists: RawImportList[];
};

export function parseGithubStarsImport(payload: unknown) {
	const value = payload as Partial<RawImportPayload>;

	if (!value || typeof value !== "object") {
		throw new Error("Import payload must be an object");
	}

	assertIsoDate(value.exportedAt, "exportedAt");

	if (!Array.isArray(value.stars)) {
		throw new Error("stars must be an array");
	}

	if (!Array.isArray(value.lists)) {
		throw new Error("lists must be an array");
	}

	const lists = value.lists.map((list, index) => parseList(list, `lists[${index}]`));
	const stars = value.stars.map((star, index) => parseStar(star, `stars[${index}]`));

	return {
		exportedAt: value.exportedAt as string,
		lists,
		stars: stars.map(({ lists: _lists, ...star }) => star),
		memberships: stars.flatMap((star) =>
			star.lists.map((list) => ({
				githubListId: list.githubListId,
				githubRepoId: star.githubRepoId,
			})),
		),
	};
}

function parseList(list: unknown, label: string) {
	const value = list as Partial<RawImportList>;

	if (!value || typeof value !== "object") {
		throw new Error(`${label} must be an object`);
	}

	if (!value.githubListId || typeof value.githubListId !== "string") {
		throw new Error(`${label}.githubListId is required`);
	}

	if (!value.name || typeof value.name !== "string") {
		throw new Error(`${label}.name is required`);
	}

	if (value.description !== undefined && typeof value.description !== "string") {
		throw new Error(`${label}.description must be a string`);
	}

	return {
		githubListId: value.githubListId,
		name: value.name,
		description: value.description ?? "",
	};
}

function parseStar(star: unknown, label: string) {
	const value = star as Partial<RawImportStar>;

	if (!value || typeof value !== "object") {
		throw new Error(`${label} must be an object`);
	}

	if (typeof value.githubRepoId !== "number") {
		throw new Error(`${label}.githubRepoId is required`);
	}

	if (!value.fullName || typeof value.fullName !== "string") {
		throw new Error(`${label}.fullName is required`);
	}

	if (value.description !== undefined && typeof value.description !== "string") {
		throw new Error(`${label}.description must be a string`);
	}

	if (!value.url || typeof value.url !== "string") {
		throw new Error(`${label}.url is required`);
	}

	if (!Array.isArray(value.lists)) {
		throw new Error(`${label}.lists must be an array`);
	}

	return {
		githubRepoId: value.githubRepoId,
		fullName: value.fullName,
		description: value.description ?? "",
		url: value.url,
		lists: value.lists.map((list, index) => parseList(list, `${label}.lists[${index}]`)),
	};
}

function assertIsoDate(value: unknown, label: string) {
	if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
		throw new Error(`${label} must be a valid ISO date`);
	}
}
