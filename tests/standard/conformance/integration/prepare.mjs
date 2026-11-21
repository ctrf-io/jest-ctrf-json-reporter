import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { configuredOptions, expectedReport } from "../expected.mjs";

export function integrationContext(root, diagnostics) {
	const consumer = mkdtempSync(path.join(tmpdir(), "ctrf-jest-consumer-"));
	const npm = process.platform === "win32" ? "npm.cmd" : "npm";
	const env = { ...process.env, CI: "true", FORCE_COLOR: "0" };
	delete env.NODE_PATH;
	delete env.NODE_OPTIONS;
	function execute(command, args, name, expected = 0) {
		const result = spawnSync(command, args, {
			cwd: consumer,
			env,
			encoding: "utf8",
			timeout: 300000,
			maxBuffer: 16 * 1024 * 1024,
		});
		if (diagnostics)
			writeFileSync(
				path.join(diagnostics, `${name}.log`),
				`${result.stdout ?? ""}\n${result.stderr ?? ""}\n${result.error ?? ""}`,
			);
		assert.ifError(result.error);
		assert.equal(result.signal, null, name);
		assert.equal(
			result.status,
			expected,
			`${name}: expected exit ${expected}\n${result.stdout}\n${result.stderr}`,
		);
		return result;
	}
	try {
		const pkg = JSON.parse(readFileSync(path.join(root, "package.json")));
		const packed = JSON.parse(
			execute(npm, ["pack", root, "--json", "--ignore-scripts"], "pack").stdout,
		)[0];
		assert.ok(
			packed.files.every((file) => !file.path.startsWith("tests/")),
			"Test sources leaked into package",
		);
		writeFileSync(
			path.join(consumer, "package.json"),
			JSON.stringify({ private: true }),
		);
		execute(
			npm,
			[
				"install",
				"--ignore-scripts",
				"--no-audit",
				"--no-fund",
				"--save-exact",
				`./${packed.filename}`,
				`jest@${pkg.devDependencies.jest}`,
			],
			"install",
		);
		cpSync(
			new URL("./fixtures/", import.meta.url),
			path.join(consumer, "fixtures"),
			{ recursive: true },
		);
		const samples = [];
		const scenarios = [
			{
				name: "hooks-and-timeout",
				mode: "hooks-and-timeout",
				options: {},
				exit: 1,
			},
			{ name: "full", mode: "mixed", options: configuredOptions, exit: 1 },
			{ name: "repeated", mode: "mixed", options: configuredOptions, exit: 1 },
			{
				name: "suite-exec-error",
				mode: "suite-exec-error",
				options: configuredOptions,
				exit: 1,
			},
			{
				name: "workers",
				mode: "mixed",
				options: configuredOptions,
				exit: 1,
				workers: true,
			},
			{ name: "minimal", mode: "mixed", options: { minimal: true }, exit: 1 },
			{ name: "defaults", mode: "passed", options: {}, exit: 0 },
			{ name: "all-skipped", mode: "all-skipped", options: {}, exit: 0 },
			{ name: "empty-run", mode: "empty", options: {}, exit: 0 },
			{
				name: "shard-one",
				mode: "passed",
				options: { ...configuredOptions, shardId: "one" },
				exit: 0,
			},
			{
				name: "shard-two",
				mode: "passed",
				options: { ...configuredOptions, shardId: "two" },
				exit: 0,
			},
		];
		for (const scenario of scenarios) {
			const outputDir = path.join(consumer, scenario.name);
			mkdirSync(outputDir);
			env.CTRF_FIXTURE_MODE = scenario.mode;
			env.CTRF_FORCE_WORKERS = String(!!scenario.workers);
			env.CTRF_FIXTURE_OPTIONS = JSON.stringify({
				...scenario.options,
				outputDir,
			});
			env.CTRF_NATIVE_OUTPUT = path.join(outputDir, "native.json");
			const start = Date.now();
			execute(
				process.execPath,
				[
					path.join(consumer, "node_modules/jest/bin/jest.js"),
					"--config",
					"fixtures/jest.config.cjs",
					"--passWithNoTests",
					...(scenario.workers ? ["--maxWorkers=2"] : ["--runInBand"]),
					...(scenario.name.startsWith("shard-")
						? [`--shard=${scenario.name === "shard-one" ? "1" : "2"}/2`]
						: []),
				],
				scenario.name,
				scenario.exit,
			);
			const bytes = readFileSync(path.join(outputDir, "ctrf-report.json"));
			const evidence = JSON.parse(readFileSync(env.CTRF_NATIVE_OUTPUT));
			const native = evidence.files;
			if (scenario.workers) {
				const pids = readFileSync(`${env.CTRF_NATIVE_OUTPUT}.processes`, "utf8")
					.trim()
					.split("\n")
					.map(Number);
				assert.ok(
					new Set(pids).size >= 2 &&
						pids.every((pid) => pid !== evidence.reporterPid),
					"Worker fixture did not use two separate worker processes",
				);
			}
			// File completion order may differ across workers; oracle and report pair by native emission order.
			const expected = expectedReport(native, scenario.options);
			for (const test of expected.results.tests) {
				if (test.name === "suite pass")
					test.extra = {
						hook: "before",
						owner: "last",
						nested: { a: 1, b: 2 },
						list: ["one", "two"],
						after: true,
					};
				else if (test.name === "suite isolated")
					test.extra = { hook: "before", isolated: true, after: true };
				else if (test.name === "second file" && test.status === "passed")
					test.extra = { file: "second" };
				else if (["suite flaky", "suite failure"].includes(test.name))
					test.extra = { hook: "before", after: true };
			}
			const sample = {
				name: scenario.name,
				report: JSON.parse(bytes),
				base64: bytes.toString("base64"),
				expected,
				runWindow: [start, Date.now()],
			};
			samples.push(sample);
			if (diagnostics) {
				writeFileSync(
					path.join(diagnostics, `${scenario.name}-subject.json`),
					bytes,
				);
				writeFileSync(
					path.join(diagnostics, `${scenario.name}-native.json`),
					JSON.stringify(native, null, 2),
				);
			}
		}
		return {
			samples,
			repeated: ["full", "repeated"],
			shards: ["shard-one", "shard-two"],
			warnings: [],
		};
	} finally {
		rmSync(consumer, { recursive: true, force: true });
	}
}
