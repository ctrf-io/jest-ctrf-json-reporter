const options = JSON.parse(process.env.CTRF_FIXTURE_OPTIONS);
const suiteExecError = process.env.CTRF_FIXTURE_MODE === "suite-exec-error";
module.exports = {
	setupFiles: ["<rootDir>/process-evidence.cjs"],
	workerIdleMemoryLimit:
		process.env.CTRF_FORCE_WORKERS === "true" ? "512MB" : undefined,
	testEnvironment: "jest-ctrf-json-reporter/environment",
	testMatch: [
		suiteExecError
			? "<rootDir>/suite-load-error.test.cjs"
			: "<rootDir>/{cases,second}.test.cjs",
	],
	testPathIgnorePatterns:
		process.env.CTRF_FIXTURE_MODE === "empty" ? [".test.cjs$"] : [],
	reporters: [
		["jest-ctrf-json-reporter", options],
		"<rootDir>/native-reporter.cjs",
	],
};
