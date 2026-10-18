import { runExpectedFailure } from "./shared/expected-failures.mjs";
import assert, { AssertionError } from "node:assert/strict";
import { checkJestEntry } from "./jest-checks.mjs";
const numericIssue = {
	issue: "invalid-build-number",
	reason: "Fractional and non-finite build numbers produce invalid output",
	followUp: "https://github.com/ctrf-io/jest-ctrf-json-reporter/issues/92",
	samples: { unit: ["fractional-build-number", "nonfinite-build-number"] },
};
const workerIssue = {
	issue: "worker-metadata-loss",
	reason: "Runtime metadata is lost across worker processes",
	followUp: "https://github.com/ctrf-io/jest-ctrf-json-reporter/issues/93",
	samples: { integration: ["workers"] },
};
export const expectedFailures = {
	"conformance/property/results.environment.buildNumber": numericIssue,
	"conformance/report/single-json-object": numericIssue,
	"conformance/property/results.tests[].extra": workerIssue,
};
export function expectedFailure(entry, level) {
	const issue = expectedFailures[entry.id];
	return issue?.samples[level] ? issue : undefined;
}
function matchesKnownFailure(entry, sample, issue, error) {
	if (!(error instanceof AssertionError)) return false;
	if (issue.issue === "worker-metadata-loss") {
		const expected = sample.expected.results.tests.map((test) => test.extra);
		if (expected.filter(Boolean).length !== 5) return false;
		try {
			assert.equal(error.operator, "deepStrictEqual");
			assert.ok(
				error.message.startsWith(
					`${sample.name}: runtime metadata source mapping\n`,
				),
			);
			assert.deepEqual(error.expected, expected);
			assert.deepEqual(
				error.actual,
				expected.map(() => undefined),
			);
			return true;
		} catch {
			return false;
		}
	}
	const value = sample.report.results.environment.buildNumber;
	if (value !== (sample.name === "fractional-build-number" ? 1.5 : null))
		return false;
	const detail =
		entry.kind === "property"
			? "results.environment.buildNumber: data must be integer"
			: "data/results/environment/buildNumber must be integer";
	return (
		error.message.split("\n")[0] === `${sample.name}: ${detail}` &&
		error.actual === false &&
		error.expected === true &&
		error.operator === "=="
	);
}
export function runConformance(entry, context, level, check = checkJestEntry) {
	return runExpectedFailure(
		entry,
		context,
		level,
		expectedFailure(entry, level),
		check,
		matchesKnownFailure,
	);
}
