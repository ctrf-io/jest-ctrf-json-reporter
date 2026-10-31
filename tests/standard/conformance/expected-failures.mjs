import { runExpectedFailure } from "./shared/expected-failures.mjs";
import { checkJestEntry } from "./jest-checks.mjs";
export const expectedFailures = {};
export function expectedFailure() {
	return undefined;
}
export function runConformance(entry, context, level, check = checkJestEntry) {
	return runExpectedFailure(
		entry,
		context,
		level,
		expectedFailure(entry, level),
		check,
		() => false,
	);
}
