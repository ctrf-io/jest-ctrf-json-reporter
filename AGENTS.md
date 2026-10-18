# Reporter testing instructions

Keep existing reporter tests and run `npm run all`. For changes affecting CTRF
output also run `npm run test:standard:conformance` and review both levels.
See [the conformance guide](tests/standard/conformance/README.md).

- Preserve common catalogue IDs. Update Jest capability reasons and native
  fixtures when support changes. Unsupported optional fields remain visible skips;
  supported defects must execute and fail, or match a narrow temporary exception.
- Compare actual serialized producer output with independent native evidence.
  Integration must run the packed distribution through real Jest, including workers.
  Missing fixtures/dependencies are failures. Never adjust expectations to match a defect.
- Keep confirmed defect exceptions reporter-local, sample/level/value specific,
  linked to a public fix issue when available. Require unexpected passes, partial
  fixes, unrelated exceptions and missing evidence to fail. Do not use skips or
  blanket expected-failure markers for supported defects.
- For schema or specification changes, assess affected properties, relationships,
  MUST/SHOULD severity, required children, boundaries, capabilities, native fixtures,
  both suites, checker controls and existing exceptions. Record verified no-change
  evidence where appropriate. The contract version differs from package versions.
- Keep packaging, options, output reliability and lifecycle quality checks separate
  from strict conformance. Do not bundle runtime fixes into an adoption assessment.
- Emit separate schema-valid unit/integration CTRF files. Expected defects are
  `other` with `rawStatus: "expected-failure"` and follow-up metadata, not passes.
- CI runs the suites in its integration job. Use GitHub Test Reporter built-in
  summary and collapsed tests, one summary variant, and updating Node 24 PR
  comments tagged `reporter-tests` and `reporter-conformance`. Retain every matrix
  runtime's artifacts. Forks retain read-only build output. No custom templates,
  redundant raw JSON reporter, or release workflow changes for adoption.
- Keep this guide and the contributor/conformance docs concise; avoid fixed test
  counts or duplicated known-defect details. Reconcile copied common sources when
  their recorded upstream revision changes.
