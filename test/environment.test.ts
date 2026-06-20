import { createCtrfJestEnvironment } from "jest-ctrf-json-reporter/environment";
import {
	consumeTestMetadata,
	clearAllMetadata,
} from "jest-ctrf-json-reporter/storage";
import type { Circus } from "@jest/types";

class MockBase {
	global: any = {};
	async setup(): Promise<void> {}
	async teardown(): Promise<void> {}
}

const CtrfEnv = createCtrfJestEnvironment(MockBase as any);

function makeEnv() {
	return new (CtrfEnv as any)(
		{ projectConfig: { rootDir: "/", testEnvironmentOptions: {} } },
		{ testPath: "/example.test.ts" },
	);
}

function makeTestEntry(name: string): Circus.TestEntry {
	const root = { name: "ROOT_DESCRIBE_BLOCK", parent: undefined } as any;
	return { name, parent: root } as any;
}

describe("CtrfJestEnvironment hook metadata", () => {
	beforeEach(() => {
		clearAllMetadata();
	});

	it("captures extra() called in beforeEach for the current test", () => {
		const env = makeEnv();
		const test = makeTestEntry("should fetch user");
		const state = { currentlyRunningTest: test } as Circus.State;
		const hook = { type: "beforeEach" } as Circus.Hook;

		env.handleTestEvent({ name: "hook_start", hook }, state);
		env.handleRuntimeMessage({ type: "extra", data: { owner: "alice" } });
		env.handleTestEvent({ name: "hook_success", hook, test }, state);

		env.handleTestEvent({ name: "test_fn_start", test }, state);
		env.handleTestEvent({ name: "test_fn_success", test }, state);
		env.handleTestEvent({ name: "run_finish" }, state);

		const metadata = consumeTestMetadata("should fetch user");
		expect(metadata?.extra).toEqual({ owner: "alice" });
	});

	it("captures extra() called in afterEach for the current test", () => {
		const env = makeEnv();
		const test = makeTestEntry("should update user");
		const state = { currentlyRunningTest: test } as Circus.State;
		const hook = { type: "afterEach" } as Circus.Hook;

		env.handleTestEvent({ name: "test_fn_start", test }, state);
		env.handleTestEvent({ name: "test_fn_success", test }, state);

		env.handleTestEvent({ name: "hook_start", hook }, state);
		env.handleRuntimeMessage({ type: "extra", data: { result: "ok" } });
		env.handleTestEvent({ name: "hook_success", hook, test }, state);

		env.handleTestEvent({ name: "run_finish" }, state);

		const metadata = consumeTestMetadata("should update user");
		expect(metadata?.extra).toEqual({ result: "ok" });
	});

	it("deep merges extra() from beforeEach and the test body", () => {
		const env = makeEnv();
		const test = makeTestEntry("should delete user");
		const state = { currentlyRunningTest: test } as Circus.State;
		const hook = { type: "beforeEach" } as Circus.Hook;

		env.handleTestEvent({ name: "hook_start", hook }, state);
		env.handleRuntimeMessage({ type: "extra", data: { owner: "alice" } });
		env.handleTestEvent({ name: "hook_success", hook, test }, state);

		env.handleTestEvent({ name: "test_fn_start", test }, state);
		env.handleRuntimeMessage({ type: "extra", data: { priority: "P1" } });
		env.handleTestEvent({ name: "test_fn_success", test }, state);

		env.handleTestEvent({ name: "run_finish" }, state);

		const metadata = consumeTestMetadata("should delete user");
		expect(metadata?.extra).toEqual({ owner: "alice", priority: "P1" });
	});
});
