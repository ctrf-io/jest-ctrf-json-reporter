import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { validateStrict } from "ctrf";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const extension of ["cjs", "js"]) {
	for (const workers of [false, true]) {
		test(`runtime metadata / ${extension} ${workers ? "workers" : "in band"} preserves project, file and hook isolation`, () => {
			const dir = mkdtempSync(
				path.join(tmpdir(), "ctrf-jest-worker-regression-"),
			);
			try {
				const evidence = path.join(dir, "evidence");
				mkdirSync(evidence);
				for (const project of ["one", "two"])
					writeFileSync(
						path.join(dir, `setup-${project}.cjs`),
						`global.PROJECT = ${JSON.stringify(project)};`,
					);
				for (const file of ["a", "b", "c"]) {
					writeFileSync(
						path.join(dir, `${file}.test.cjs`),
						`
const {extra} = require(${JSON.stringify(path.join(root, "dist/runtime.cjs"))});
require('node:fs').writeFileSync(require('node:path').join(${JSON.stringify(evidence)}, PROJECT + '-${file}.json'), JSON.stringify({pid:process.pid}));
extra({outside:true});
describe('hooks', () => {
 beforeEach(() => extra({hook:{before:true}, list:['before'], owner:'before'}));
 afterEach(() => extra({hook:{after:true}, list:['after'], owner:'after'}));
 test('same', async () => {
  extra({project:PROJECT,file:'${file}',nested:{a:1},list:['body'],owner:'body'});
  extra({nested:{b:2},list:['more']});
  await new Promise(resolve=>setTimeout(resolve,40));
 });
 test('isolated', () => extra({isolated:true}));
});
test('none', () => {});
jest.retryTimes(1,{retryImmediately:true});
let attempt=0;
test('retry', () => { extra({attempt:++attempt}); expect(attempt).toBe(2); });
test.skip('skip', () => {});
test.todo('todo');
`,
					);
				}
				const config = {
					rootDir: dir,
					workerIdleMemoryLimit: workers ? "512MB" : undefined,
					projects: ["one", "two"].map((project) => ({
						displayName: project,
						rootDir: dir,
						testMatch: ["<rootDir>/*.test.cjs"],
						setupFiles: [path.join(dir, `setup-${project}.cjs`)],
						testEnvironment: path.join(root, `dist/environment.${extension}`),
					})),
					reporters: [
						[path.join(root, `dist/index.${extension}`), { outputDir: dir }],
					],
				};
				const configPath = path.join(dir, "jest.config.cjs");
				writeFileSync(configPath, `module.exports=${JSON.stringify(config)};`);
				const run = spawnSync(
					process.execPath,
					[
						path.join(root, "node_modules/jest/bin/jest.js"),
						"--config",
						configPath,
						workers ? "--maxWorkers=2" : "--runInBand",
					],
					{
						cwd: dir,
						encoding: "utf8",
						timeout: 60000,
						env: { ...process.env, FORCE_COLOR: "0" },
					},
				);
				assert.ifError(run.error);
				assert.equal(run.status, 0, run.stdout + run.stderr);
				const report = JSON.parse(
					readFileSync(path.join(dir, "ctrf-report.json"), "utf8"),
				);
				validateStrict(report);
				assert.equal(report.results.tests.length, 36);
				const pids = new Set(
					readdirSync(evidence).map(
						(file) =>
							JSON.parse(readFileSync(path.join(evidence, file), "utf8")).pid,
					),
				);
				if (workers) {
					assert.ok(pids.size >= 2, "two distinct workers required");
					assert.ok(
						!pids.has(run.pid),
						"tests must run outside reporter process",
					);
				} else assert.deepEqual([...pids], [run.pid]);
				const seen = new Set();
				for (const result of report.results.tests) {
					if (result.name === "hooks same") {
						const { project, file } = result.extra;
						seen.add(`${project}/${file}`);
						assert.deepEqual(result.extra, {
							hook: { before: true, after: true },
							list: ["before", "body", "more", "after"],
							owner: "after",
							project,
							file,
							nested: { a: 1, b: 2 },
						});
					} else if (result.name === "hooks isolated")
						assert.deepEqual(result.extra, {
							hook: { before: true, after: true },
							list: ["before", "after"],
							owner: "after",
							isolated: true,
						});
					else if (result.name === "retry") {
						assert.equal(result.status, "passed");
						assert.equal(result.retries, 1);
						assert.deepEqual(result.extra, { attempt: 2 });
					} else assert.equal(result.extra, undefined, result.name);
				}
				assert.equal(
					seen.size,
					6,
					"metadata from all file/project pairs required",
				);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		});
	}
}
