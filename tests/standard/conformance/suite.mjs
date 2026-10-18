import { readFileSync } from "node:fs";
import { after, test } from "node:test";
import { catalogue, disposition } from "./shared/checks.mjs";
import { expectedFailure, runConformance } from "./expected-failures.mjs";
import { unitContext } from "./unit/fixtures.mjs";
const level = process.env.CTRF_CONFORMANCE_LEVEL;
const manifest = JSON.parse(
	readFileSync(new URL("./jest.json", import.meta.url), "utf8"),
);
const context =
	level === "unit"
		? unitContext()
		: JSON.parse(readFileSync(process.env.CTRF_CONFORMANCE_CONTEXT, "utf8"));
if (level !== "unit") {
	for (const sample of context.samples)
		sample.bytes = Buffer.from(sample.base64, "base64");
	for (const key of ["repeated", "shards"])
		context[key] = context[key].map((name) =>
			context.samples.find((sample) => sample.name === name),
		);
}
for (const entry of catalogue.entries) {
	const capability = disposition(entry, manifest);
	const issue = expectedFailure(entry, level);
	test(
		`${entry.id}${issue ? ` [expected failure: ${issue.issue}]` : ""}`,
		{ skip: capability.supported ? false : capability.reason },
		() => runConformance(entry, context, level),
	);
}
after(() =>
	console.log(
		`Conformance recommendations: ${JSON.stringify(context.warnings)}`,
	),
);
