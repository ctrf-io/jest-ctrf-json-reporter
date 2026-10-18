const { extra } = require("jest-ctrf-json-reporter/runtime");
const mode = process.env.CTRF_FIXTURE_MODE;
if (mode === "all-skipped") {
	test.skip("skipped", () => {});
} else if (mode === "hooks-and-timeout") {
	describe("hook failure", () => {
		beforeAll(() => {
			throw new Error("fixture beforeAll failure");
		});
		test("blocked", () => {});
	});
	test("timeout", async () => {
		await new Promise((resolve) => setTimeout(resolve, 80));
	}, 20);
} else if (mode !== "empty") {
	describe("suite", () => {
		beforeEach(() => extra({ hook: "before" }));
		afterEach(() => extra({ after: true }));
		test("pass", () => {
			extra({ owner: "first", nested: { a: 1 }, list: ["one"] });
			extra({ owner: "last", nested: { b: 2 }, list: ["two"] });
			expect(2 + 2).toBe(4);
		});
		test("isolated", () => {
			extra({ isolated: true });
			expect(true).toBe(true);
		});
		if (mode === "mixed") {
			jest.retryTimes(1, {
				logErrorsBeforeRetry: true,
				retryImmediately: true,
			});
			let attempt = 0;
			test("flaky", () => {
				expect(++attempt).toBe(2);
			});
			test("failure", () => {
				throw new Error("fixture failure");
			});
			test.skip("skip", () => {});
			test.todo("todo");
		}
	});
}
