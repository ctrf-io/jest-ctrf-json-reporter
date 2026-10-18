import assert from "node:assert/strict";
import { checkEntry } from "./shared/checks.mjs";

export function checkJestEntry(entry, context) {
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
