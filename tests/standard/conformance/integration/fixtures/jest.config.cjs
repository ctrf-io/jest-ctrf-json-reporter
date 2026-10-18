const options = JSON.parse(process.env.CTRF_FIXTURE_OPTIONS);
module.exports = {
	setupFiles: ["<rootDir>/process-evidence.cjs"],
	workerIdleMemoryLimit:
		process.env.CTRF_FORCE_WORKERS === "true" ? "512MB" : undefined,
	testEnvironment: "jest-ctrf-json-reporter/environment",
	testMatch: ["<rootDir>/*.test.cjs"],
	testPathIgnorePatterns:
		process.env.CTRF_FIXTURE_MODE === "empty" ? [".test.cjs$"] : [],
	reporters: [
		["jest-ctrf-json-reporter", options],
		"<rootDir>/native-reporter.cjs",
	],
};
