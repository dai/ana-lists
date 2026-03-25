import { describe, expect, it } from "vitest";

import {
	resolveInitialLanguage,
	resolveInitialTheme,
	type Language,
	type Theme,
} from "../client/src/ui-preferences";
import { copy } from "../client/src/copy";

describe("resolveInitialLanguage", () => {
	it("prefers a stored language when it is valid", () => {
		expect(resolveInitialLanguage({ storedLanguage: "ja", navigatorLanguage: "en-US" })).toBe("ja");
	});

	it("falls back to japanese when browser language is japanese", () => {
		expect(resolveInitialLanguage({ storedLanguage: null, navigatorLanguage: "ja-JP" })).toBe("ja");
	});

	it("falls back to english for non-japanese browsers", () => {
		expect(resolveInitialLanguage({ storedLanguage: null, navigatorLanguage: "en-US" })).toBe("en");
	});
});

describe("resolveInitialTheme", () => {
	it("prefers a stored theme when it is valid", () => {
		expect(resolveInitialTheme({ storedTheme: "dark", prefersDark: false })).toBe("dark");
	});

	it("uses system preference when there is no stored theme", () => {
		expect(resolveInitialTheme({ storedTheme: null, prefersDark: true })).toBe("dark");
		expect(resolveInitialTheme({ storedTheme: null, prefersDark: false })).toBe("light");
	});
});

describe("copy", () => {
	it("exposes both english and japanese labels for the top controls", () => {
		const languages: Language[] = ["en", "ja"];
		const themes: Theme[] = ["light", "dark"];

		for (const language of languages) {
			expect(copy[language].controls.language).toBeTruthy();
			expect(copy[language].controls.theme).toBeTruthy();
			for (const theme of themes) {
				expect(copy[language].themeOptions[theme]).toBeTruthy();
			}
		}
	});
});
