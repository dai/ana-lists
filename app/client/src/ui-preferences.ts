export type Language = "en" | "ja";
export type Theme = "light" | "dark";

export const LANGUAGE_STORAGE_KEY = "ana-lists-language";
export const THEME_STORAGE_KEY = "ana-lists-theme";

export function resolveInitialLanguage(input: {
	storedLanguage: string | null;
	navigatorLanguage: string | null;
}): Language {
	if (isLanguage(input.storedLanguage)) {
		return input.storedLanguage;
	}

	return input.navigatorLanguage?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function resolveInitialTheme(input: {
	storedTheme: string | null;
	prefersDark: boolean;
}): Theme {
	if (isTheme(input.storedTheme)) {
		return input.storedTheme;
	}

	return input.prefersDark ? "dark" : "light";
}

export function isLanguage(value: string | null): value is Language {
	return value === "en" || value === "ja";
}

export function isTheme(value: string | null): value is Theme {
	return value === "light" || value === "dark";
}
