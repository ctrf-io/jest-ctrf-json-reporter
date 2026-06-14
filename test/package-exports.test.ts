import { createRequire } from "node:module";
import Reporter, {
	CtrfJestEnvironment,
	ctrf,
	extra,
	storeTestMetadata,
} from "jest-ctrf-json-reporter";

const cjsRequire = createRequire(__filename);

describe("package exports", () => {
	it("supports ESM default and named imports", async () => {
		const esm = await import("jest-ctrf-json-reporter");

		expect(typeof Reporter).toBe("function");
		expect(Reporter.name).toBe("GenerateCtrfReport");
		expect(typeof extra).toBe("function");
		expect(typeof ctrf.extra).toBe("function");
		expect(typeof CtrfJestEnvironment).toBe("function");
		expect(typeof storeTestMetadata).toBe("function");
		expect(typeof esm.default).toBe("function");
		expect(typeof esm.extra).toBe("function");
		expect(typeof esm.ctrf.extra).toBe("function");
	});

	it("supports CJS require from the package root", () => {
		const CjsReporter = cjsRequire("jest-ctrf-json-reporter");

		expect(typeof CjsReporter).toBe("function");
		expect(CjsReporter.name).toBe("GenerateCtrfReport");
		expect(typeof CjsReporter.extra).toBe("function");
		expect(typeof CjsReporter.ctrf.extra).toBe("function");
		expect(typeof CjsReporter.CtrfJestEnvironment).toBe("function");
		expect(typeof CjsReporter.storeTestMetadata).toBe("function");
	});

	it("supports CJS require from public subpaths", () => {
		const runtime = cjsRequire("jest-ctrf-json-reporter/runtime");
		const environment = cjsRequire("jest-ctrf-json-reporter/environment");
		const storage = cjsRequire("jest-ctrf-json-reporter/storage");

		expect(typeof runtime.extra).toBe("function");
		expect(typeof runtime.ctrf.extra).toBe("function");
		expect(typeof environment.default).toBe("function");
		expect(typeof environment.createCtrfJestEnvironment).toBe("function");
		expect(typeof storage.storeTestMetadata).toBe("function");
	});
});
