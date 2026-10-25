import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { configuredOptions, expectedReport } from "../expected.mjs";
const require = createRequire(import.meta.url);
const Reporter = require("../../../../dist/index.cjs");
const { storeTestMetadata, clearAllMetadata } = Reporter;
export function unitContext() {
	const directory = mkdtempSync(path.join(tmpdir(), "ctrf-jest-unit-"));
	const samples = [];
	try {
		const makeCase = (title, status, extra = {}) => ({
			title,
			fullName: `suite ${title}`,
			ancestorTitles: ["suite"],
			status,
			duration: 12,
			failureMessages:
				status === "failed"
					? ["fixture failure\n    at fixture (case.cjs:1:1)"]
					: [],
			invocations: 1,
			...extra,
		});
		const assertions = [
			makeCase("pass", "passed"),
			makeCase("unicode ✓", "passed", { duration: undefined }),
			makeCase("failure", "failed"),
			makeCase("skip", "pending"),
			makeCase("todo", "todo"),
			makeCase("flaky", "passed", {
				invocations: 2,
				retryReasons: ["first failure"],
			}),
			makeCase("retry failure", "failed", {
				invocations: 3,
				retryReasons: ["first failure", "second failure"],
			}),
			makeCase("unknown", "disabled"),
		];
		const native = [
			{
				testFilePath: path.resolve("fixture/cases.test.cjs"),
				testResults: assertions,
			},
		];
		const suiteExecError = [
			{
				testFilePath: path.resolve("fixture/suite-load-error.test.cjs"),
				testResults: [makeCase("passes before teardown", "passed")],
				testExecError: {
					message: "fixture teardown failure",
					stack:
						"Error: fixture teardown failure\n    at fixture (suite-load-error.test.cjs:1:1)",
				},
				failureMessage:
					"Error: fixture teardown failure\n    at fixture (suite-load-error.test.cjs:1:1)",
			},
		];
		for (const [name, options, files] of [
			["full", configuredOptions, native],
			["repeated", configuredOptions, native],
			["suite-exec-error", configuredOptions, suiteExecError],
			["minimal", { minimal: true }, native],
			["defaults", {}, native],
			["empty-run-id", { runId: "" }, native],
			["custom-type", { testType: "component" }, native],
			["empty-run", {}, []],
			[
				"custom-identity",
				{
					...configuredOptions,
					customIdentity: true,
					testIdResolver: ({ name }) => `custom:${name}`,
				},
				native,
			],
			["shard-one", { ...configuredOptions, shardId: "one" }, native],
			["shard-two", { ...configuredOptions, shardId: "two" }, native],
			[
				"fractional-build-number",
				{ ...configuredOptions, buildNumber: 1.5 },
				native,
			],
			[
				"nonfinite-build-number",
				{ ...configuredOptions, buildNumber: Infinity },
				native,
			],
		]) {
			clearAllMetadata();
			const start = Date.now();
			const reporter = new Reporter(
				{},
				{ ...options, outputDir: directory, outputFile: `${name}.json` },
				{},
			);
			reporter.onRunStart();
			for (const file of files) {
				storeTestMetadata(
					JSON.stringify([file.testFilePath, "", "suite pass"]),
					{
						extra: {
							owner: "fixture",
							nested: { value: 1 },
							list: ["one", "two"],
						},
					},
				);
				reporter.onTestResult(
					{ context: { config: {} } },
					structuredClone(file),
				);
			}
			reporter.onRunComplete();
			const bytes = readFileSync(path.join(directory, `${name}.json`));
			const expected = expectedReport(files, options);
			if (
				files.some((file) =>
					file.testResults.some((test) => test.fullName === "suite pass"),
				)
			)
				expected.results.tests[0].extra = {
					owner: "fixture",
					nested: { value: 1 },
					list: ["one", "two"],
				};
			samples.push({
				name,
				bytes,
				report: JSON.parse(bytes),
				expected,
				runWindow: [start, Date.now()],
			});
		}
		return {
			samples,
			repeated: samples.slice(0, 2),
			shards: samples.filter((sample) => sample.name.startsWith("shard-")),
			warnings: [],
		};
	} finally {
		clearAllMetadata();
		rmSync(directory, { recursive: true, force: true });
	}
}
