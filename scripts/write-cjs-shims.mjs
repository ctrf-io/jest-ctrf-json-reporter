import { writeFileSync } from "node:fs";

writeFileSync(
	"dist/index.cjs",
	`"use strict";

const mod = require("./index.generated.cjs");
const Reporter = mod.default || mod;

module.exports = Object.assign(Reporter, {
  CTRF_RUNTIME_KEY: mod.CTRF_RUNTIME_KEY,
  __RUNTIME_KEY: mod.__RUNTIME_KEY,
  __clearRuntime: mod.__clearRuntime,
  __setRuntime: mod.__setRuntime,
  clearAllMetadata: mod.clearAllMetadata,
  consumeTestMetadata: mod.consumeTestMetadata,
  createCtrfJestEnvironment: mod.createCtrfJestEnvironment,
  ctrf: mod.ctrf,
  extra: mod.extra,
  getMetadataCount: mod.getMetadataCount,
  peekTestMetadata: mod.peekTestMetadata,
  storeTestMetadata: mod.storeTestMetadata,
  CtrfJestEnvironment: mod.CtrfJestEnvironment,
});
`,
);
