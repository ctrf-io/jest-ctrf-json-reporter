import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getSchema } from "ctrf";
import {
	catalogue,
	checkEntry,
	reportChecks,
	valuesAt,
	disposition,
} from "../shared/checks.mjs";
import { runConformance } from "../expected-failures.mjs";
import { checkJestEntry } from "../jest-checks.mjs";
import { createReport } from "../reporters/ctrf.mjs";
import { unitContext } from "./fixtures.mjs";
const property = (path) =>
	catalogue.entries.find((entry) => entry.path === path);
const rule = (name) => catalogue.entries.find((entry) => entry.rule === name);
function control() {
	const report = {
		reportFormat: "CTRF",
		specVersion: "0.2.0",
		results: {
			tool: { name: "control" },
			summary: {
				tests: 1,
				passed: 1,
				failed: 0,
				pending: 0,
				skipped: 0,
				other: 0,
				start: 100,
				stop: 120,
			},
			tests: [
				{
					name: "case",
					status: "passed",
					duration: 12,
					retries: 1,
					flaky: true,
					attemptId: "final",
					retryAttempts: [{ attempt: 1, attemptId: "first", status: "failed" }],
				},
			],
		},
	};
	return {
		samples: [
			{
				name: "valid",
				report,
				bytes: Buffer.from(JSON.stringify(report)),
				expected: {
					results: {
						tests: [
							{
								duration: 12,
								sourceAttempts: [
									{ status: "failed" },
									{ status: "passed", duration: 12 },
								],
							},
						],
					},
				},
			},
		],
		warnings: [],
	};
}
test("checker / catalogue exactly covers expanded schema and shared relationships", () => {
	const schema = getSchema("0.2.0");
	const paths = [];
	function walk(input, prefix = "") {
		const node = input.$ref
			? input.$ref
					.slice(2)
					.split("/")
					.reduce((value, key) => value[key], schema)
			: input;
		for (const [key, child] of Object.entries(node.properties ?? {})) {
			const path = prefix ? `${prefix}.${key}` : key;
			paths.push(path);
			walk(child, path);
		}
		if (node.items) walk(node.items, `${prefix}[]`);
	}
	walk(schema);
	assert.deepEqual(
		catalogue.entries
			.filter((entry) => entry.kind === "property")
			.map((entry) => entry.path),
		paths,
	);
	assert.deepEqual(
		catalogue.entries
			.filter((entry) => entry.kind === "report")
			.map((entry) => entry.rule)
			.sort(),
		Object.keys(reportChecks).sort(),
	);
	const manifest = JSON.parse(
		readFileSync(new URL("../jest.json", import.meta.url)),
	);
	for (const entry of catalogue.entries) disposition(entry, manifest);
	assert.equal(Object.keys(manifest.properties).length, paths.length);
	assert.equal(
		Object.keys(manifest.rules).length,
		Object.keys(reportChecks).length,
	);
});
test("checker / capability skips do not hide emitted fields", () => {
	const manifest = JSON.parse(
		readFileSync(new URL("../jest.json", import.meta.url)),
	);
	const context = unitContext();
	for (const [path, capability] of Object.entries(manifest.properties))
		if (!capability.supported)
			assert.equal(
				context.samples.flatMap((sample) => valuesAt(sample.report, path))
					.length,
				0,
				path,
			);
});
test("checker / accepts independent valid document and retry history", () => {
	const context = control();
	for (const name of [
		"single-json-object",
		"summary-matches-final-results",
		"history-orders-contiguous-attempts",
		"history-excludes-final-attempt",
		"flaky-matches-attempt-outcomes",
	])
		checkEntry(rule(name), context);
});
for (const [name, mutate] of [
	[
		"single-json-object",
		(sample) => {
			sample.report.unknown = true;
			sample.bytes = Buffer.from(JSON.stringify(sample.report));
		},
	],
	[
		"utf8-without-bom",
		(sample) => {
			sample.bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d]);
		},
	],
	[
		"summary-matches-final-results",
		(sample) => {
			sample.report.results.summary.passed++;
		},
	],
	[
		"history-orders-contiguous-attempts",
		(sample) => {
			sample.report.results.tests[0].retryAttempts[0].attempt = 2;
		},
	],
	[
		"retry-count-matches-history-length",
		(sample) => {
			sample.report.results.tests[0].retries = 2;
		},
	],
	[
		"history-excludes-final-attempt",
		(sample) => {
			sample.report.results.tests[0].retryAttempts.push({
				attempt: 2,
				status: "passed",
			});
		},
	],
	[
		"flaky-matches-attempt-outcomes",
		(sample) => {
			sample.report.results.tests[0].flaky = false;
		},
	],
	[
		"respects-reserved-extension-ownership",
		(sample) => {
			sample.report.results.tests[0].extra = { "ctrf.not-owned": true };
		},
	],
])
	test(`checker / rejects independent ${name} mutation`, () => {
		const context = control();
		mutate(context.samples[0]);
		assert.throws(() => reportChecks[name](context));
	});
test("checker / rejects source duration unit mismatch", () => {
	const context = control();
	context.samples[0].report.results.tests[0].duration *= 1000;
	assert.throws(() =>
		checkEntry(property("results.tests[].duration"), context),
	);
});
test("checker / requires positive optional evidence and required children", () => {
	assert.throws(
		() => checkEntry(property("results.tests[].screenshot"), control()),
		/No positive evidence/,
	);
	const context = control();
	delete context.samples[0].report.results.tests[0].status;
	assert.throws(
		() => checkEntry(property("results.tests[].status"), context),
		/missing/,
	);
});
test("checker / missing contextual evidence fails; SHOULD deviation warns", () => {
	assert.throws(
		() => checkEntry(rule("case-identity-stable-across-runs"), control()),
		/Missing repeated/,
	);
	assert.throws(
		() => checkEntry(rule("coordinates-run-and-shard-identity"), control()),
		/Missing shard/,
	);
	const context = control();
	context.samples[0].report.results.summary.stop = 50;
	checkEntry(rule("orders-start-and-stop"), context);
	assert.equal(context.warnings.length, 1);
});
test("checker / compares complete runtime object source mapping", () => {
	const context = control();
	context.samples[0].expected.results.tests[0].extra = { owner: "expected" };
	context.samples[0].report.results.tests[0].extra = { owner: "wrong" };
	assert.throws(
		() => checkJestEntry(property("results.tests[].extra"), context),
		/runtime metadata source mapping/,
	);
});
function numericContext() {
	return {
		samples: [1.5, null].map((value, index) => {
			const sample = control().samples[0];
			sample.name = index
				? "nonfinite-build-number"
				: "fractional-build-number";
			sample.report.results.environment = { buildNumber: value };
			sample.bytes = Buffer.from(JSON.stringify(sample.report));
			return sample;
		}),
	};
}
test("exceptions / exact numeric defects reproduce at affected level", () => {
	assert.equal(
		runConformance(
			property("results.environment.buildNumber"),
			numericContext(),
			"unit",
		).issue,
		"invalid-build-number",
	);
});
for (const [name, mutate] of [
	[
		"fully fixed",
		(context) => {
			for (const sample of context.samples)
				sample.report.results.environment.buildNumber = 0;
		},
	],
	[
		"partially fixed",
		(context) => {
			context.samples[1].report.results.environment.buildNumber = 0;
		},
	],
	[
		"different value",
		(context) => {
			context.samples[0].report.results.environment.buildNumber = "bad";
		},
	],
	[
		"missing fixture",
		(context) => {
			context.samples.pop();
		},
	],
	[
		"duplicate fixture",
		(context) => {
			context.samples.push(context.samples[0]);
		},
	],
])
	test(`exceptions / rejects ${name}`, () => {
		const context = numericContext();
		mutate(context);
		assert.throws(() =>
			runConformance(
				property("results.environment.buildNumber"),
				context,
				"unit",
			),
		);
	});
test("exceptions / infrastructure error is never accepted", () => {
	assert.throws(
		() =>
			runConformance(
				property("results.environment.buildNumber"),
				numericContext(),
				"unit",
				() => {
					throw new Error("infrastructure");
				},
			),
		/infrastructure/,
	);
});
test("exceptions / same bug at unrecorded level fails normally", () => {
	assert.throws(() =>
		runConformance(
			property("results.environment.buildNumber"),
			numericContext(),
			"integration",
		),
	);
});
test("exceptions / unrecorded samples keep running", () => {
	const context = numericContext();
	const sample = control().samples[0];
	sample.report.results.environment = { buildNumber: "invalid" };
	context.samples.push(sample);
	assert.throws(() =>
		runConformance(
			property("results.environment.buildNumber"),
			context,
			"unit",
		),
	);
});
function workerContext() {
	const sample = control().samples[0];
	sample.name = "workers";
	sample.report.results.tests = Array.from({ length: 5 }, () => ({
		name: "case",
		status: "passed",
		duration: 1,
	}));
	sample.expected.results.tests = Array.from({ length: 5 }, (_, index) => ({
		extra: { index },
	}));
	return { samples: [sample] };
}
test("exceptions / exact worker loss matches; partial and full fixes fail", () => {
	const entry = property("results.tests[].extra");
	assert.equal(
		runConformance(entry, workerContext(), "integration").issue,
		"worker-metadata-loss",
	);
	const context = workerContext();
	context.samples[0].report.results.tests[0].extra = { index: 0 };
	assert.throws(() => runConformance(entry, context, "integration"));
	for (const [index, test] of context.samples[0].report.results.tests.entries())
		test.extra = { index };
	assert.throws(
		() => runConformance(entry, context, "integration"),
		/Unexpected pass/,
	);
});
test("reporting / expected failures are Other with identity and issue metadata", () => {
	const name =
		"conformance/property/results.environment.buildNumber [expected failure: invalid-build-number]";
	const report = createReport(
		[
			{ name, status: "passed", duration: 0.51 },
			{ name: "normal", status: "passed" },
			{ name: "broken", status: "failed" },
			{ name: "unsupported", status: "skipped" },
			{ name: "unfinished", status: "pending" },
		],
		"unit",
		"node:test",
		0,
		10,
	);
	assert.deepEqual(report.results.summary, {
		tests: 5,
		start: 0,
		stop: 10,
		passed: 1,
		failed: 1,
		skipped: 1,
		pending: 1,
		other: 1,
	});
	assert.equal(report.results.tests[0].rawStatus, "expected-failure");
	assert.equal(report.results.tests[0].duration, 1);
	assert.equal(
		report.results.tests[0].extra.expectedFailure.issue,
		"invalid-build-number",
	);
	assert.notEqual(
		report.results.tests[0].testId,
		createReport(
			[{ name, status: "passed" }],
			"integration",
			"node:test",
			0,
			10,
		).results.tests[0].testId,
	);
});
test("reporting / different failures and unmatched level or label stay ordinary results", () => {
	const name =
		"conformance/property/results.environment.buildNumber [expected failure: invalid-build-number]";
	assert.equal(
		createReport([{ name, status: "failed" }], "unit", "node:test", 0, 1)
			.results.summary.failed,
		1,
	);
	assert.equal(
		createReport([{ name, status: "passed" }], "integration", "node:test", 0, 1)
			.results.summary.passed,
		1,
	);
	assert.equal(
		createReport(
			[{ name: name.split(" [")[0], status: "passed" }],
			"unit",
			"node:test",
			0,
			1,
		).results.summary.passed,
		1,
	);
});
test("reporting / rejects invalid runner status and nonfinite timing", () => {
	assert.throws(() =>
		createReport(
			[{ name: "bad", status: "unknown" }],
			"unit",
			"node:test",
			0,
			1,
		),
	);
	assert.throws(() =>
		createReport(
			[{ name: "bad", status: "passed", duration: Infinity }],
			"unit",
			"node:test",
			0,
			1,
		),
	);
});

test("reporting / Node adapter retains skips, TODOs and failures without duplicate parents", async () => {
	const { default: nodeReporter } = await import("../reporters/node.mjs");
	const { mkdtempSync, rmSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { reportPath } = await import("../reporters/ctrf.mjs");
	const directory = mkdtempSync(join(tmpdir(), "ctrf-jest-report-control-"));
	const previous = process.env.CTRF_STANDARD_ARTIFACTS;
	process.env.CTRF_STANDARD_ARTIFACTS = directory;
	try {
		async function* events() {
			for (const data of [
				{
					name: "conformance/property/results.environment.buildNumber [expected failure: invalid-build-number]",
					details: { duration_ms: 0.1 },
				},
				{
					name: "skip",
					skip: "capability reason",
					details: { duration_ms: 0 },
				},
				{
					name: "todo",
					todo: "pending implementation",
					details: { duration_ms: 0 },
				},
			])
				yield { type: "test:pass", data };
			yield {
				type: "test:fail",
				data: {
					name: "failure",
					details: { duration_ms: 1, error: new Error("real failure") },
				},
			};
			yield {
				type: "test:fail",
				data: {
					name: "parent",
					details: { error: { failureType: "subtestsFailed" } },
				},
			};
		}
		for await (const chunk of nodeReporter(events())) assert.equal(chunk, "");
		const report = JSON.parse(readFileSync(reportPath("unit")));
		assert.equal(report.results.summary.tests, 4);
		assert.equal(report.results.summary.other, 1);
		assert.equal(report.results.summary.skipped, 1);
		assert.equal(report.results.summary.pending, 1);
		assert.equal(report.results.summary.failed, 1);
		assert.equal(
			report.results.tests.find((test) => test.status === "skipped").message,
			"capability reason",
		);
	} finally {
		if (previous === undefined) delete process.env.CTRF_STANDARD_ARTIFACTS;
		else process.env.CTRF_STANDARD_ARTIFACTS = previous;
		rmSync(directory, { recursive: true, force: true });
	}
});

test("checker / total count recommendation warns without hiding schema violations", () => {
	const context = control();
	context.samples[0].report.results.summary.tests = 2;
	context.samples[0].expected.results.summary = { tests: 1 };
	checkJestEntry(property("results.summary.tests"), context);
	checkJestEntry(rule("summary-matches-final-results"), context);
	assert.equal(context.warnings.length, 1);
	context.samples[0].report.results.summary.tests = -1;
	assert.throws(() =>
		checkJestEntry(property("results.summary.tests"), context),
	);
});
