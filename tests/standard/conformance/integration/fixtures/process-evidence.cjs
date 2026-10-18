require("node:fs").appendFileSync(
	`${process.env.CTRF_NATIVE_OUTPUT}.processes`,
	`${process.pid}\n`,
);
