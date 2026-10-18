import path from "node:path";

// Native assertion data is captured independently of the CTRF reporter.
export function expectedReport(native, options = {}) {
	const tests = native.flatMap((file) =>
		file.testResults.map((test) => {
			const status = ["passed", "failed", "skipped", "pending"].includes(
				test.status,
			)
				? test.status
				: "other";
			const base = {
				name: test.fullName,
				status,
				duration: test.duration ?? 0,
			};
			if (options.customIdentity) base.testId = `custom:${test.title}`;
			if (options.minimal) return base;
			return {
				...base,
				rawStatus: test.status,
				filePath: file.testFilePath,
				type: options.testType ?? "unit",
				suite: [path.basename(file.testFilePath), ...test.ancestorTitles],
				retries: (test.invocations ?? 1) - 1,
				flaky: status === "passed" && (test.invocations ?? 1) > 1,
				// Jest exposes retry reasons but no individual retry duration.
				sourceAttempts: [
					...Array.from({ length: (test.invocations ?? 1) - 1 }, () => ({
						status: "failed",
					})),
					{ status, duration: test.duration ?? 0 },
				],
			};
		}),
	);
	const summary = { tests: tests.length };
	for (const status of ["passed", "failed", "skipped", "pending", "other"])
		summary[status] = tests.filter((test) => test.status === status).length;
	const environment = Object.fromEntries(
		Object.keys(configuredOptions)
			.filter((key) => key !== "runId" && options[key] !== undefined)
			.map((key) => [key, options[key]]),
	);
	return {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		generatedBy: "jest-ctrf-json-reporter",
		...(options.runId ? { runId: options.runId } : {}),
		results: { tool: { name: "jest" }, summary, tests, environment },
	};
}
export const configuredOptions = {
	runId: "standard-run",
	shardId: "standard-shard",
	appName: "fixture-app",
	appVersion: "2.0.0",
	buildName: "standard-build",
	buildNumber: 0,
	buildUrl: "https://example.test/build/0",
	repositoryName: "fixture-repository",
	repositoryUrl: "https://example.test/repository",
	branchName: "fixture-branch",
	osPlatform: "fixture-platform",
	osRelease: "fixture-release",
	osVersion: "fixture-version",
	testEnvironment: "fixture-environment",
};
