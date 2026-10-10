import { defineConfig } from "tsup";

export default defineConfig([
	{
		entry: {
			index: "src/index.ts",
			runtime: "src/runtime.ts",
			environment: "src/environment.ts",
			storage: "src/storage.ts",
		},
		format: ["esm"],
		dts: {
			// tsup injects baseUrl; scope this option to the TypeScript 6 API build.
			compilerOptions: { ignoreDeprecations: "6.0" },
			entry: {
				index: "src/index.ts",
				runtime: "src/runtime.ts",
				environment: "src/environment.ts",
				storage: "src/storage.ts",
			},
		},
		clean: true,
		external: [
			"@jest/environment",
			"@jest/reporters",
			"@jest/test-result",
			"@jest/types",
			"jest-environment-node",
		],
		shims: true,
		splitting: false,
		outDir: "dist",
	},
	{
		entry: {
			"index.generated": "src/index.ts",
			runtime: "src/runtime.ts",
			environment: "src/environment.ts",
			storage: "src/storage.ts",
		},
		format: ["cjs"],
		dts: false,
		clean: false,
		external: [
			"@jest/environment",
			"@jest/reporters",
			"@jest/test-result",
			"@jest/types",
			"jest-environment-node",
		],
		shims: true,
		splitting: false,
		outDir: "dist",
	},
]);
