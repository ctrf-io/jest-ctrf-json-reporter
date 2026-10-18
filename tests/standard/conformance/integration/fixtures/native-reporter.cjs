const fs = require("node:fs");
module.exports = class NativeEvidence {
	constructor() {
		this.files = [];
	}
	onTestResult(_test, result) {
		this.files.push(result);
	}
	onRunComplete() {
		fs.writeFileSync(
			process.env.CTRF_NATIVE_OUTPUT,
			JSON.stringify({ files: this.files, reporterPid: process.pid }),
		);
	}
};
