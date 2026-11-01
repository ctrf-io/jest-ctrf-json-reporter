import assert from "node:assert/strict";
import GenerateCtrfReport from "../src/generate-report";
import type { TestResult, Status } from "@jest/test-result";
import type { ReporterContext } from "@jest/reporters";
import type { Config } from "@jest/types";
import { CURRENT_SPEC_VERSION, validateStrict } from "ctrf";

interface ReporterConfigOptions {
	outputFile?: string;
	minimal?: boolean;
	buildNumber?: number;
}

describe("GenerateCtrfReport", () => {
	let reporter: GenerateCtrfReport;
	beforeEach(() => {
		const mockGlobalConfig: Config.GlobalConfig = {} as Config.GlobalConfig;
		const mockreporterOptions: ReporterConfigOptions = {
			minimal: true,
		} as ReporterConfigOptions;
		const mockreporterContext: ReporterContext = {} as ReporterContext;
		reporter = new GenerateCtrfReport(
			mockGlobalConfig,
			mockreporterOptions,
			mockreporterContext,
		);
	});

	describe("Set config options", () => {
		it("emits the current CTRF specification version", () => {
			expect(reporter.ctrfReport.specVersion).toBe(CURRENT_SPEC_VERSION);
		});

		it("produces a strictly valid base report", () => {
			expect(() =>
				validateStrict(reporter.ctrfReport, {
					specVersion: CURRENT_SPEC_VERSION,
				}),
			).not.toThrow();
		});

		it("emits a numeric environment build number", () => {
			const configuredReporter = new GenerateCtrfReport(
				{} as Config.GlobalConfig,
				{ minimal: true, buildNumber: 100 },
				{} as ReporterContext,
			);

			configuredReporter.onRunStart();

			expect(
				configuredReporter.ctrfReport.results.environment?.buildNumber,
			).toBe(100);
			expect(() =>
				validateStrict(configuredReporter.ctrfReport, {
					specVersion: CURRENT_SPEC_VERSION,
				}),
			).not.toThrow();
		});

		describe("filename", () => {
			it("should set filename from reporterConfigOptions if present", () => {
				const mockFilename = "mockFilename.json";
				const mockGlobalConfig: Config.GlobalConfig = {} as Config.GlobalConfig;
				const mockreporterOptions: ReporterConfigOptions = {
					outputFile: mockFilename,
				} as ReporterConfigOptions;
				const mockreporterContext: ReporterContext = {} as ReporterContext;
				reporter = new GenerateCtrfReport(
					mockGlobalConfig,
					mockreporterOptions,
					mockreporterContext,
				);

				expect((reporter as any).filename).toBe(mockFilename);
			});

			it("should use default filename if reporterConfigOptions filename is not present", () => {
				expect((reporter as any).filename).toBe(
					(reporter as any).defaultOutputFile,
				);
			});
		});
	});

	describe("setFilename", () => {
		it("should add .json extension if none provided", () => {
			(reporter as any).setFilename("myReport");
			expect((reporter as any).filename).toBe("myReport.json");
		});

		it("should keep .json extension if already provided", () => {
			(reporter as any).setFilename("myReport.json");
			expect((reporter as any).filename).toBe("myReport.json");
		});

		it("should append .json to any other extensions", () => {
			(reporter as any).setFilename("myReport.txt");
			expect((reporter as any).filename).toBe("myReport.txt.json");
		});
	});

	describe("updateCtrfTestResultsFromTestResult", () => {
		it("should update the ctrfReport with required test properties", () => {
			const mockTestCaseResult = {
				status: "passed" as Status,
				fullName: "Test Case Full Name",
				duration: 100,
			};
			const mockResult: TestResult = {
				testResults: [mockTestCaseResult],
			} as TestResult;

			(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

			const updatedTestResult = reporter.ctrfReport.results.tests[0];

			expect(updatedTestResult.name).toBe(mockTestCaseResult.fullName);
			expect(updatedTestResult.status).toBe(mockTestCaseResult.status);
			expect(updatedTestResult.duration).toBe(mockTestCaseResult.duration);
		});

		it.each([
			["Test 1", "passed", 100],
			["Test 2", "failed", 200],
			["Test 3", "skipped", 300],
			["Test 4", "pending", 50],
		])(
			'should correctly update the ctrfReport for test "%s" with status "%s" and duration %i',
			(testTitle, status, duration) => {
				const mockTestCaseResult = {
					status: status as Status,
					fullName: testTitle,
					duration: duration,
				};
				const mockResult: TestResult = {
					testResults: [mockTestCaseResult],
				} as TestResult;

				(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

				const updatedTestResult =
					reporter.ctrfReport.results.tests[
						reporter.ctrfReport.results.tests.length - 1
					];

				expect(updatedTestResult.name).toBe(testTitle);
				expect(updatedTestResult.status).toBe(status);
				expect(updatedTestResult.duration).toBe(duration);
			},
		);

		it.each([["todo"], ["disabled"], ["focused"]])(
			'should correctly update the ctrfReport for test with status "%s" as other',
			(status) => {
				const mockTestCaseResult = {
					status: status as Status,
					fullName: "testTitle",
					duration: 100,
				};
				const mockResult: TestResult = {
					testResults: [mockTestCaseResult],
				} as TestResult;

				(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

				const updatedTestResult =
					reporter.ctrfReport.results.tests[
						reporter.ctrfReport.results.tests.length - 1
					];

				expect(updatedTestResult.status).toBe("other");
			},
		);

		it("records a suite-level execution error as a failed test", () => {
			const mockResult = {
				testFilePath: "/path/to/syntax-error.test.ts",
				testResults: [
					{
						title: "passes before the suite error",
						fullName: "passes before the suite error",
						ancestorTitles: [],
						duration: 1,
						status: "passed",
					},
				],
				testExecError: {
					message: "SyntaxError: Unexpected token",
					stack: "SyntaxError: Unexpected token\n    at transform.ts:1:1",
				},
			} as unknown as TestResult;

			reporter.onTestResult({} as never, mockResult);

			expect(reporter.ctrfReport.results.tests).toHaveLength(2);
			expect(reporter.ctrfReport.results.tests[1]).toMatchObject({
				name: "syntax-error.test.ts (test suite failed to run)",
				duration: 0,
				status: "failed",
			});
			expect(reporter.ctrfReport.results.tests[1].rawStatus).toBeUndefined();
			expect(reporter.ctrfReport.results.summary).toMatchObject({
				tests: 2,
				passed: 1,
				failed: 1,
			});
			expect(() =>
				validateStrict(reporter.ctrfReport, {
					specVersion: CURRENT_SPEC_VERSION,
				}),
			).not.toThrow();
		});

		it("does not record a suite-level failure for a null execution error", () => {
			const mockResult = {
				testFilePath: "/path/to/passing.test.ts",
				testResults: [],
				testExecError: null,
			} as unknown as TestResult;

			reporter.onTestResult({} as never, mockResult);

			expect(reporter.ctrfReport.results.tests).toHaveLength(0);
			expect(reporter.ctrfReport.results.summary).toMatchObject({
				tests: 0,
				failed: 0,
			});
		});
	});

	describe("updateTotalsFromTestResult", () => {
		it("should update the total tests count", () => {
			const mockTestCaseResult = {
				status: "passed" as Status,
				fullName: "Test Case Full Name",
				duration: 100,
			};
			const mockResult: TestResult = {
				testResults: [mockTestCaseResult],
			} as TestResult;

			(reporter as any).updateTotalsFromTestResult(mockResult);

			expect(reporter.ctrfReport.results.summary.tests).toBe(1);
		});

		it.each([
			["passed", 1, 0, 0, 0, 0],
			["failed", 0, 1, 0, 0, 0],
			["skipped", 0, 0, 1, 0, 0],
			["pending", 0, 0, 0, 1, 0],
			["todo", 0, 0, 0, 0, 1],
			["disabled", 0, 0, 0, 0, 1],
			["focused", 0, 0, 0, 0, 1],
		])(
			"should update for status %s",
			(status, passed, failed, skipped, pending, other) => {
				const mockTestCaseResult = {
					status: status as Status,
					fullName: "Test Case Full Name",
					duration: 100,
				};
				const mockResult: TestResult = {
					testResults: [mockTestCaseResult],
				} as TestResult;

				(reporter as any).updateTotalsFromTestResult(mockResult);

				expect(reporter.ctrfReport.results.summary.passed).toBe(passed);
				expect(reporter.ctrfReport.results.summary.failed).toBe(failed);
				expect(reporter.ctrfReport.results.summary.skipped).toBe(skipped);
				expect(reporter.ctrfReport.results.summary.pending).toBe(pending);
				expect(reporter.ctrfReport.results.summary.other).toBe(other);
			},
		);
	});
});

describe("GenerateDetailedCtrfReport", () => {
	let reporter: GenerateCtrfReport;
	beforeEach(() => {
		const mockGlobalConfig: Config.GlobalConfig = {} as Config.GlobalConfig;
		const mockreporterOptions: ReporterConfigOptions = {
			minimal: false,
		} as ReporterConfigOptions;
		const mockreporterContext: ReporterContext = {} as ReporterContext;
		reporter = new GenerateCtrfReport(
			mockGlobalConfig,
			mockreporterOptions,
			mockreporterContext,
		);
	});

	it("emits the suite hierarchy as an ordered string array", () => {
		const mockTestCaseResult = {
			status: "passed" as Status,
			fullName: "parent child Test Case Full Name",
			ancestorTitles: ["parent", "child"],
			duration: 100,
		};
		const mockResult = {
			testFilePath: "/path/to/test.ts",
			testResults: [mockTestCaseResult],
		} as TestResult;

		(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

		expect(reporter.ctrfReport.results.tests[0].suite).toEqual([
			"test.ts",
			"parent",
			"child",
		]);
	});

	it("emits conformant history for retried tests", () => {
		const mockTestCaseResult = {
			status: "passed" as Status,
			fullName: "retried test",
			ancestorTitles: ["retry suite"],
			duration: 100,
			invocations: 3,
			retryReasons: ["first failure", "second failure"],
		};
		const mockResult = {
			testFilePath: "/path/to/retry.test.ts",
			testResults: [mockTestCaseResult],
		} as TestResult;

		(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);
		(reporter as any).updateTotalsFromTestResult(mockResult);

		const test = reporter.ctrfReport.results.tests[0];
		expect(test.retries).toBe(2);
		expect(test.flaky).toBe(true);
		expect(test.retryAttempts).toMatchObject([
			{ attempt: 1, status: "failed", message: "first failure" },
			{ attempt: 2, status: "failed", message: "second failure" },
		]);
		expect(() =>
			validateStrict(reporter.ctrfReport, {
				specVersion: CURRENT_SPEC_VERSION,
			}),
		).not.toThrow();
	});

	it("preserves details for a suite-level execution error", () => {
		const mockResult = {
			testFilePath: "/path/to/module-load-error.test.ts",
			testResults: [],
			testExecError: {
				message: "\u001b[1;31mError: boom while loading\u001b[0m",
				stack:
					"\u001b[1;31mError: boom while loading\u001b[0m\n    at module-load-error.test.ts:1:1",
			},
		} as unknown as TestResult;

		reporter.onTestResult({} as never, mockResult);

		expect(reporter.ctrfReport.results.tests[0]).toMatchObject({
			name: "module-load-error.test.ts (test suite failed to run)",
			status: "failed",
			rawStatus: "testExecError",
			message: "Error: boom while loading\n",
			trace: "at module-load-error.test.ts:1:1",
			type: "unit",
			filePath: "/path/to/module-load-error.test.ts",
			retries: 0,
			flaky: false,
			suite: ["module-load-error.test.ts"],
		});
		expect(reporter.ctrfReport.results.summary).toMatchObject({
			tests: 1,
			failed: 1,
		});
		expect(() =>
			validateStrict(reporter.ctrfReport, {
				specVersion: CURRENT_SPEC_VERSION,
			}),
		).not.toThrow();
	});

	it("uses a safe fallback when execution error details are empty", () => {
		const mockResult = {
			testFilePath: "/path/to/empty-error.test.ts",
			failureMessage: "",
			testResults: [],
			testExecError: {},
		} as unknown as TestResult;

		reporter.onTestResult({} as never, mockResult);

		expect(reporter.ctrfReport.results.tests[0]).toMatchObject({
			name: "empty-error.test.ts (test suite failed to run)",
			status: "failed",
			message: "Test suite failed to run",
		});
		expect(reporter.ctrfReport.results.tests[0].trace).toBeUndefined();
	});

	it("does not duplicate failed assertion output in an execution error", () => {
		const mockResult = {
			testFilePath: "/path/to/failed-and-teardown-error.test.ts",
			failureMessage:
				"Error: assertion failed\n    at assertion.test.ts:1:1\n\nError: teardown failed",
			testExecError: {
				message: "",
				stack: "",
			},
			testResults: [
				{
					title: "fails before teardown",
					fullName: "fails before teardown",
					ancestorTitles: [],
					duration: 1,
					status: "failed",
					failureMessages: [
						"Error: assertion failed\n    at assertion.test.ts:1:1",
					],
				},
			],
		} as unknown as TestResult;

		reporter.onTestResult({} as never, mockResult);

		expect(reporter.ctrfReport.results.tests).toHaveLength(2);
		expect(reporter.ctrfReport.results.tests[1]).toMatchObject({
			status: "failed",
			message: "Test suite failed to run",
		});
		expect(reporter.ctrfReport.results.summary).toMatchObject({
			tests: 2,
			failed: 2,
		});
	});

	it("adds a failed record when teardown fails after passing tests", () => {
		const mockResult = {
			testFilePath: "/path/to/after-all-error.test.ts",
			failureMessage:
				"\u001b[31mError: boom in afterAll\u001b[39m\n    at after-all-error.test.ts:3:9",
			testExecError: {
				message: "",
				stack: "",
			},
			testResults: [
				{
					title: "passes before teardown",
					fullName: "passes before teardown",
					ancestorTitles: [],
					duration: 1,
					status: "passed",
				},
			],
		} as unknown as TestResult;

		reporter.onTestResult({} as never, mockResult);

		expect(reporter.ctrfReport.results.tests).toHaveLength(2);
		expect(reporter.ctrfReport.results.tests[1]).toMatchObject({
			name: "after-all-error.test.ts (test suite failed to run)",
			status: "failed",
			message: "Error: boom in afterAll\n",
			trace: "at after-all-error.test.ts:3:9",
		});
		expect(reporter.ctrfReport.results.summary).toMatchObject({
			tests: 2,
			passed: 1,
			failed: 1,
		});
		expect(() =>
			validateStrict(reporter.ctrfReport, {
				specVersion: CURRENT_SPEC_VERSION,
			}),
		).not.toThrow();
	});

	it("should update the ctrfReport message with error description from failureMessages on failed builds", () => {
		const mockTestCaseResult = {
			status: "failed" as Status,
			fullName: "Test Case Full Name",
			ancestorTitles: ["parent"],
			duration: 100,

			failureMessages: [
				'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m"b"\u001b[39m\nReceived: \u001b[31mundefined\u001b[39m\n    at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\n    at Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n)',
			],
		};
		const mockResult: TestResult = {
			testFilePath: "/path/to/test.ts",
			testResults: [mockTestCaseResult],
		} as TestResult;

		(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

		const updatedTestResult = reporter.ctrfReport.results.tests[0];

		expect(updatedTestResult.message).toBe(
			'Error: expect(received).toBe(expected) // Object.is equality\n\nExpected: "b"\nReceived: undefined\n',
		);
	});

	it("preserves stackless assertion failure text in message and trace", () => {
		const mockTestCaseResult = {
			status: "failed" as Status,
			fullName: "stackless failure",
			ancestorTitles: [],
			duration: 1,
			failureMessages: ["Error: stackless failure"],
		};
		const mockResult = {
			testFilePath: "/path/to/stackless.test.ts",
			testResults: [mockTestCaseResult],
		} as unknown as TestResult;

		(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

		expect(reporter.ctrfReport.results.tests[0]).toMatchObject({
			message: "Error: stackless failure",
			trace: "Error: stackless failure",
		});
	});

	it("should update the ctrfReport trace with stack trace from failureMessage on failed builds", () => {
		const mockTestCaseResult = {
			status: "failed" as Status,
			fullName: "Test Case Full Name",
			ancestorTitles: ["parent"],
			duration: 100,
			failureMessages: [
				'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m"b"\u001b[39m\nReceived: \u001b[31mundefined\u001b[39m\n    at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\n    at Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n',
			],
		};
		const mockResult: TestResult = {
			testFilePath: "/path/to/test.ts",
			testResults: [mockTestCaseResult],
		} as TestResult;

		(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

		const updatedTestResult = reporter.ctrfReport.results.tests[0];

		expect(updatedTestResult.trace).toBe(
			"at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\nat Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n",
		);
	});

	it("should not append failureDetails to trace", () => {
		const mockTestCaseResult = {
			status: "failed" as Status,
			fullName: "Test Case Full Name",
			ancestorTitles: ["parent"],
			failureDetails: [
				{
					matcherResult: {
						actual: undefined,
						expected: "b",
						message:
							'expect(received).toBe(expected) // Object.is equality\n\nExpected: "b"\nReceived: undefined',
						name: "toBe",
						pass: false,
					},
				},
				{},
			],
			duration: 100,
			failureMessages: [
				'Error: \u001b[2mexpect(\u001b[22m\u001b[31mreceived\u001b[39m\u001b[2m).\u001b[22mtoBe\u001b[2m(\u001b[22m\u001b[32mexpected\u001b[39m\u001b[2m) // Object.is equality\u001b[22m\n\nExpected: \u001b[32m"b"\u001b[39m\nReceived: \u001b[31mundefined\u001b[39m\n    at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\n    at Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n',
			],
		};
		const mockResult: TestResult = {
			testFilePath: "/path/to/test.ts",
			testResults: [mockTestCaseResult],
		} as TestResult;

		(reporter as any).updateCtrfTestResultsFromTestResult(mockResult);

		const updatedTestResult = reporter.ctrfReport.results.tests[0];

		expect(updatedTestResult.trace).toBe(
			"at Object.<anonymous> (/jest-ctrf-json-reporter/test/generate-report.test.ts:133:41)\nat Promise.then.completed (/jest-ctrf-json-reporter/node_modules/jest-circus/build/utils.js:298:28)\n",
		);
	});
});

describe("buildNumber configuration", () => {
	for (const [buildNumber, expected, warningCount] of [
		[0, 0, 0],
		[-1, -1, 0],
		[100, 100, 0],
		[Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 1, 0],
		[undefined, undefined, 0],
		[1.5, undefined, 1],
		[NaN, undefined, 1],
		[Infinity, undefined, 1],
		[-Infinity, undefined, 1],
	] as const) {
		it(`serializes ${String(buildNumber)} with ${warningCount} warning(s)`, () => {
			const warn = console.warn;
			const warnings: unknown[] = [];
			console.warn = (message) => warnings.push(message);
			try {
				const reporter = new GenerateCtrfReport(
					{} as Config.GlobalConfig,
					{ buildNumber },
					{} as ReporterContext,
				);
				reporter.onRunStart();
				const report = JSON.parse(JSON.stringify(reporter.ctrfReport));
				assert.equal(report.results.environment?.buildNumber, expected);
				assert.equal(
					Object.hasOwn(report.results.environment ?? {}, "buildNumber"),
					expected !== undefined,
				);
				assert.equal(warnings.length, warningCount);
				if (warningCount)
					assert.equal(
						warnings[0],
						"[CTRF] buildNumber must be a finite integer; omitting invalid value.",
					);
				assert.doesNotThrow(() => validateStrict(report));
			} finally {
				console.warn = warn;
			}
		});
	}
});
