import assert from "node:assert/strict";
import { checkEntry } from "./shared/checks.mjs";

export function checkJestEntry(entry, context) {
	if (entry.path === "results.summary.failed") {
		const sample = context.samples.find(
			(candidate) => candidate.name === "suite-exec-error",
		);
		assert.ok(sample, "Missing suite execution error fixture");
		const executionErrors = sample.report.results.tests.filter(
			(result) => result.rawStatus === "testExecError",
		);
		assert.equal(executionErrors.length, 1);
		assert.match(executionErrors[0].name, /\(test suite failed to run\)$/u);
		assert.equal(executionErrors[0].status, "failed");
		assert.match(executionErrors[0].message, /fixture .* failure/iu);
		assert.match(executionErrors[0].trace, /^at /u);
		assert.equal(
			sample.report.results.summary.failed,
			sample.report.results.tests.filter((result) => result.status === "failed")
				.length,
		);
	}
	if (entry.path === "results.tests[].extra") {
		for (const sample of context.samples) {
			const expected = sample.expected.results.tests;
			assert.deepEqual(
				sample.report.results.tests.map((test) => test.extra),
				expected.map((test) => test.extra),
				`${sample.name}: runtime metadata source mapping`,
			);
		}
	}
	checkEntry(entry, context);
}
