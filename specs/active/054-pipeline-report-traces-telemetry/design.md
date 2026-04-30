# Design

Thin consumer of the existing trace-scan infrastructure. `formatReport` is a pure formatter; `main()` is a thin I/O wrapper that delegates aggregation to `trace-scan.ts`.

## Approach

1. `formatReport(report: TraceScanReport): string` — maps the `TraceScanReport` struct to a four-line compact summary. Pure: no subprocess calls, no I/O. Aggregates tools across all sessions from `sessions[*].tools_by_name`, formats `files_touched_top`, counts anomaly arrays.
2. `main()` — parses `--traces-dir` from argv (default `".claude/traces"`), calls `loadTraces(dir, null)`, calls `aggregate({ events, repoRoot: process.cwd() })`, then `console.log(formatReport(report))`.
3. Package registration: `"pipeline:report": "bun scripts/pipeline-report.ts"` in `package.json`.

Unit tests call `formatReport` directly with fixture `TraceScanReport` objects — no subprocess needed.
BDD test spawns the script via `Bun.spawn` with `--traces-dir <tmpdir>` and checks exit 0 + non-empty stdout.

## Files touched

- `scripts/pipeline-report.ts` — new script (`formatReport` exported + `main`)
- `scripts/pipeline-report.test.ts` — unit tests for `formatReport` (slice 1 gate)
- `package.json` — add `"pipeline:report": "bun scripts/pipeline-report.ts"` to scripts
- `tests/pipeline-report-bdd.test.ts` — BDD integration gate (outer gate + slice 2 gate): file existence, package.json entry, exported API, subprocess run

## Output format

```
sessions: N  events: M
top tools: Write(K), Read(J), Bash(I)
top files: path/a(K), path/b(J)
anomalies: loops=X drift=Y retries=Z blocks=W
```

- `sessions: N` — `report.sessions_scanned`; `events: M` — `report.events_total`
- `top tools` — merged `tools_by_name` across all sessions, sorted desc, formatted as `Name(count)`
- `top files` — from `report.files_touched_top`, formatted as `path(count)`
- `anomalies` — `loops=report.loops.length drift=report.drift.length retries=report.retries.length blocks=report.blocks.length`
- Empty lists produce valid zero-state (empty tool/file lists, all-zero anomaly counts)

## Decisions

- **`scripts/` root (not `scripts/agentic/`)** — `pipeline-report.ts` is a consumer/reporter, not agent plumbing; consistent with `auto-status.ts` and `auto-age-buckets.ts` at the root level. `scripts/agentic/` is reserved for agent infrastructure.
- **Multi-line output** — trace telemetry has four orthogonal dimensions; a single line would truncate anomaly detail. Morning digest post-processor handles multi-line output.
- **Import from `trace-scan.ts`** — aggregation logic is already correct and tested; re-implementing would violate DRY.
- **Export `formatReport`** — enables pure-function unit tests without subprocess or mocking; same pattern as `auto-status.ts` (`parsePrList`, `formatLine`).

## Out of scope

- Re-implementing `loadTraces` or `aggregate`
- Pagination or large-trace streaming (trace dir is ~16 KB currently)
- Real trace I/O inside unit tests
- `--since` / `--session` filtering (that is trace-scan's domain)
