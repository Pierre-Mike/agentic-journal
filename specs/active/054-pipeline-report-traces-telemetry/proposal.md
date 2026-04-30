---
id: 054-pipeline-report-traces-telemetry
title: Add pipeline:report script aggregating trace telemetry
status: active
kind: code
# kind:code — per-task gates declared in tasks.md; listed here for readability only
gate:
  - path: scripts/pipeline-report.test.ts
    level: unit
  - path: tests/pipeline-report-bdd.test.ts
    level: integration
created: 2026-04-30
owner: main
depends_on: []
supersedes: null
---

## Intent

Add `scripts/pipeline-report.ts`, registered as `bun run pipeline:report` in `package.json`, that reads `.claude/traces/*.jsonl` files using the existing `TraceScanReport` infrastructure from `scripts/agentic/trace-scan.ts` and prints a compact, human-readable summary of pipeline telemetry: sessions scanned, total events, top tools, top files touched, and any detected anomalies (loops, drift, retries, blocks). This gives the morning digest and `/retro` workflows a quick at-a-glance report without invoking the full verbose trace-scan CLI, filling the gap from issue #107.

## Constraints

- Imports `loadTraces`, `aggregate`, `TraceScanReport` from `scripts/agentic/trace-scan.ts` — no re-implementation of aggregation logic
- Exports `formatReport(report: TraceScanReport): string` for test isolation — no I/O inside this function
- `--traces-dir <path>` optional CLI flag (default `".claude/traces"`) passed through to `loadTraces`
- Empty traces produce valid zero-state output, not an error
- TypeScript strict mode; `noUncheckedIndexedAccess: true`; no `any`; no `as` casts outside tests
- No new npm dependencies
- Test file `scripts/pipeline-report.test.ts` uses `bun:test`; covers zero-state, single-session, multi-session with anomalies

## Acceptance criteria

- [ ] `scripts/pipeline-report.ts` exists and exports `formatReport(report: TraceScanReport): string`
- [ ] `formatReport` outputs four lines: `sessions: N  events: M`, `top tools: ...`, `top files: ...`, `anomalies: loops=X drift=Y retries=Z blocks=W`
- [ ] `formatReport` with empty `TraceScanReport` (zero sessions) produces valid zero-state output
- [ ] `main()` calls `loadTraces()` + `aggregate()` from `trace-scan`, then prints `formatReport(report)` to stdout
- [ ] `package.json` has `"pipeline:report": "bun scripts/pipeline-report.ts"` under scripts
- [ ] `scripts/pipeline-report.test.ts` covers zero-state, single-session, and multi-session-with-anomalies fixtures
- [ ] `bun scripts/pipeline-report.ts --traces-dir <tmpdir>` exits 0 and prints non-empty stdout

## Context

- `scripts/agentic/trace-scan.ts` (specs 005 + 011) provides `loadTraces`, `aggregate`, `TraceScanReport` — reused without modification
- Sibling scripts follow same pattern: `scripts/auto-status.ts` (spec 052), `scripts/auto-age-buckets.ts` (spec 053)
- Related GitHub issue: #107
