import { identityValue, runIdentity, testIdentity } from "../src/identity";

describe("identity semantics", () => {
	it("normalizes paths but preserves suite component boundaries", () => {
		const a = {
			name: "same",
			suite: ["a/b", "c"],
			filePath: "tests\\example.ts",
		};
		expect(testIdentity("runner", a)).toBe(
			testIdentity("runner", { ...a, filePath: "tests/example.ts" }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, suite: ["a", "b/c"] }),
		);
		expect(testIdentity("runner", a)).not.toBe(
			testIdentity("runner", { ...a, filePath: "tests/other.ts" }),
		);
	});
	it("shares configured run identity and creates independent standalone runs", () => {
		expect(runIdentity("coordinated-run")).toBe("coordinated-run");
		expect(runIdentity()).not.toBe(runIdentity());
		expect(() => identityValue(" ", "shardId")).toThrow();
	});
	it("supports an explicit case resolver without allowing empty identity", () => {
		expect(
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "stable-case" },
			),
		).toBe("stable-case");
		expect(() =>
			testIdentity(
				"runner",
				{ name: "duplicate" },
				{ testIdResolver: () => "" },
			),
		).toThrow();
	});
});

import Reporter from "../src/generate-report";
it("distinguishes files with identical test names in minimal output", () => {
	const reporter = new Reporter(
		{} as never,
		{ minimal: true, runId: "run", shardId: "one" },
		{} as never,
	);
	const assertion = {
		title: "case",
		fullName: "suite case",
		ancestorTitles: ["suite"],
		duration: 1,
		status: "passed",
	};
	for (const file of ["a.test.ts", "b.test.ts"])
		reporter.onTestResult(
			{} as never,
			{ testFilePath: file, testResults: [assertion] } as never,
		);
	expect(reporter.ctrfReport.results.tests[0].testId).not.toBe(
		reporter.ctrfReport.results.tests[1].testId,
	);
	expect(reporter.ctrfReport.results.tests[0].executionId).not.toBe(
		reporter.ctrfReport.results.tests[1].executionId,
	);
});
it("resets artifact, run and executions when a reporter is reused in watch mode", () => {
	const reporter = new Reporter({} as never, { minimal: true }, {} as never);
	const result = {
		testFilePath: "a.test.ts",
		testResults: [
			{
				title: "case",
				fullName: "case",
				ancestorTitles: [],
				duration: 1,
				status: "passed",
			},
		],
	};
	reporter.onRunStart();
	reporter.onTestResult({} as never, result as never);
	const first = { ...reporter.ctrfReport };
	const firstTest = reporter.ctrfReport.results.tests[0];
	reporter.onRunStart();
	reporter.onTestResult({} as never, result as never);
	expect(reporter.ctrfReport.reportId).not.toBe(first.reportId);
	expect(reporter.ctrfReport.runId).not.toBe(first.runId);
	expect(reporter.ctrfReport.results.tests).toHaveLength(1);
	expect(reporter.ctrfReport.results.tests[0].testId).toBe(firstTest.testId);
	expect(firstTest.attemptId).toBeTruthy();
	expect(reporter.ctrfReport.results.tests[0].attemptId).not.toBe(
		firstTest.attemptId,
	);
	expect(reporter.ctrfReport.results.tests[0].executionId).not.toBe(
		firstTest.executionId,
	);
});
it("distinguishes the same file in different named Jest projects", () => {
	const reporter = new Reporter({} as never, { minimal: true }, {} as never);
	const result = {
		testFilePath: "a.test.ts",
		testResults: [
			{
				title: "case",
				fullName: "case",
				ancestorTitles: [],
				duration: 1,
				status: "passed",
			},
		],
	};
	for (const name of ["browser-a", "browser-b"])
		reporter.onTestResult(
			{ context: { config: { displayName: { name } } } } as never,
			result as never,
		);
	expect(reporter.ctrfReport.results.tests[0].testId).not.toBe(
		reporter.ctrfReport.results.tests[1].testId,
	);
});
