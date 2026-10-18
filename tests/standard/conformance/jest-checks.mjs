import assert from "node:assert/strict";
import { checkEntry, valuesAt } from "./shared/checks.mjs";

export function checkJestEntry(entry, context) {
	// Prose bounds are mandatory even where the released schema only says integer.
	if (
		entry.kind === "property" &&
		(/^results\.summary\.(tests|passed|failed|skipped|pending|other|flaky|suites|duration)$/u.test(
			entry.path,
		) ||
			entry.path.endsWith(".duration") ||
			entry.path.endsWith(".retries"))
	) {
		for (const sample of context.samples)
			for (const value of valuesAt(sample.report, entry.path))
				assert.ok(
					value >= 0,
					`${sample.name}: ${entry.path} must be nonnegative`,
				);
	}
	// Core §8.1 makes total/array equality a SHOULD; schema type and bounds
	// remain mandatory. Preserve the pinned checker and adapt that severity here.
	if (entry.path === "results.summary.tests") {
		const samples = context.samples.map((sample) => {
			const expected = structuredClone(sample.expected);
			delete expected.results.summary.tests;
			return { ...sample, expected };
		});
		checkEntry(entry, { ...context, samples });
		return;
	}
	if (entry.rule === "summary-matches-final-results") {
		for (const sample of context.samples) {
			const { summary, tests } = sample.report.results;
			if (summary.tests !== tests.length) {
				context.warnings ??= [];
				context.warnings.push(
					`${sample.name}: summary.tests differs from test array length (SHOULD, Core §8.1)`,
				);
			}
			for (const status of ["passed", "failed", "skipped", "pending", "other"])
				assert.equal(
					summary[status],
					tests.filter((test) => test.status === status).length,
				);
		}
		return;
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
