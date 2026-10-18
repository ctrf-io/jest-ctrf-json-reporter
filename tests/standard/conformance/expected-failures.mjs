import assert, { AssertionError } from "node:assert/strict";
import { valuesAt } from "./shared/checks.mjs";
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
	const issue = expectedFailure(entry, level);
	if (!issue) return check(entry, context);
	const expectedSamples = new Set(issue.samples[level]);
	for (const name of expectedSamples)
		assert.equal(
			context.samples.filter((sample) => sample.name === name).length,
			1,
			`Expected-failure fixture missing or duplicated: ${name}`,
		);
	// Check every sample, including those after the original first failure.
	for (const sample of context.samples) {
		const parentPath = entry.path?.split(".").slice(0, -1).join(".");
		const hasParent =
			!parentPath || valuesAt(sample.report, parentPath).length > 0;
		// Optional absence in other modes is legitimate. The required known-bug
		// samples below still have to emit and reproduce their exact violation.
		if (
			entry.kind === "property" &&
			(!entry.required || !hasParent) &&
			!expectedSamples.has(sample.name) &&
			valuesAt(sample.report, entry.path).length === 0
		)
			continue;
		let failure;
		try {
			check(entry, { ...context, samples: [sample] });
		} catch (error) {
			failure = error;
		}
		if (!expectedSamples.has(sample.name)) {
			if (failure) throw failure;
			continue;
		}
		assert.ok(
			failure,
			`Unexpected pass: ${entry.id} / ${sample.name}; review and remove the expected-failure marker`,
		);
		if (!matchesKnownFailure(entry, sample, issue, failure)) throw failure;
	}
	return {
		id: entry.id,
		level,
		samples: [...expectedSamples],
		issue: issue.issue,
		reason: issue.reason,
		followUp: issue.followUp,
	};
}
