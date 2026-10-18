# Reporter conformance

These suites check serialized Jest reporter output against the released CTRF
schema and specification. They supplement the existing reporter tests.

```sh
npm run test:standard:conformance
npm run test:standard:conformance:unit
npm run test:standard:conformance:integration
```

Unit fixtures feed native results into the built producer. Integration installs a
packed distribution in a fresh consumer and runs real Jest in-band and with
workers. Native evidence supplies independent outcomes, retry counts and timing;
fixtures also exercise runtime metadata, minimal/default output, empty runs,
repeat identity and coordinated partition labels.

`jest.json` declares supported properties and relationships. Unsupported optional
features stay visible as reasoned skips. Applicable unfinished cases are pending;
supported defects fail unless a narrow exception in `expected-failures.mjs`
reproduces its exact sample, level and assertion. Unexpected passes require review.
Follow linked fix issues for defect details. A green baseline containing expected
failures does not establish full conformance.

The catalogue and checker are copied unchanged from the Playwright pilot at
`ce5a283425b6d64fd49e197a10a0c0cba1adebcc`; the normative source is the released
Core contract, loaded through the exact `ctrf` dependency. Jest uses Node's test
runner for both suites, native Jest evidence and reporter-local defect matching.
The local adapter preserves the advisory severity of total-count equality in
Core §8.1. Exact runtime object comparisons verify Jest’s advertised metadata
contract, rather than imposing its merge API on other reporters.
Jest provides retry reasons, but no per-retry duration: unsupported optional
attempt timing has no fabricated values. Keep source revisions explicit until a
shared distribution is established.

Results go to `ctrf/reports/`, or `$CTRF_STANDARD_ARTIFACTS/reports/` with retained
integration diagnostics alongside them. Fixture reports are inputs, never test
result publication files. Expected failures use CTRF `other`, explicit labels and
follow-up metadata. Recommendations are warnings. Checker controls are identified
separately from contract families.

CI retains every Node runtime's reports and publishes separate updating Node 24
PR comments for reporter tests and conformance using GitHub Test Reporter's
built-in summary and collapsed test table. Same-repository PRs can update comments;
forks retain build summaries and artifacts. Release workflow behavior is unchanged.

When the contract changes, assess affected family IDs, schema/prose constraints,
severity, capabilities, source mappings, boundary/omission cases, both levels,
checker controls and exception records. Update the catalogue deliberately; a
property registration is a family of evidence, not exhaustive specification coverage.
