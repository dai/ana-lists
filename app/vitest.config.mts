import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		environmentMatchGlobs: [["test/**/*.dom.spec.tsx", "jsdom"]],
		include: ["test/**/*.spec.ts", "test/**/*.spec.tsx"],
	},
});
