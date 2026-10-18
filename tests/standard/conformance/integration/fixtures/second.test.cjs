const { extra } = require("jest-ctrf-json-reporter/runtime");
const second =
	process.env.CTRF_FIXTURE_MODE === "all-skipped" ? test.skip : test;
second("second file", () => {
	extra({ file: "second" });
	expect(1).toBe(1);
});
