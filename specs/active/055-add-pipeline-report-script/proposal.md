---
id: 055-add-pipeline-report-script
title: Add pipeline report script
status: active
kind: code
# Outer BDD gates — both must pass before the spec is complete.
# scripts/pipeline-report.test.ts      : integration — all four test groups,
#   Test 4 uses Bun.spawnSync (CLI subprocess).
# scripts/pipeline-report-unit.test.ts : unit — function-level tests for
#   parseTraces + aggregateSessions (Tests 1 & 2 in unit form).
# Per-slice gates are declared in tasks.md; these entries are both written
# at scaffold time in RED form.
gate:
  - path: scripts/pipeline-report.test.ts
    level: integration
  - path: scripts/pipeline-report-unit.test.ts
    level: unit
created: 2026-04-30
owner: main
depends_on: []
supersedes: null
---

## Intent

Add `bun run pipeline:report` — a read-only CLI script (`scripts/pipeline-report.ts`) that parses every `.claude/traces/*.jsonl` file in the repo, aggregates per-session token counts and wall-clock durations, and prints a one-screen dashboard to stdout. This makes existing telemetry visible at a glance from the terminal and serves as the natural feeder for future dashboards or digest agents that need session-level cost/time summaries.

## Constraints

- Read-only: no writes to `.claude/traces/` or any other path
- No new runtime dependencies — use `Bun.file().text()` + split/`JSON.parse` for JSONL parsing
- TypeScript strict: `strict: true`, `noUncheckedIndexedAccess: true`, no `any`, no `as` casts outside the test file
- Immutability by default: `readonly` arrays and objects throughout
- Named params for functions with 3+ arguments
- Session display: first 8 characters of filename stem (e.g. `aaaa1111`)
- Duration: file-span — `max(started_at + duration_ms) − min(started_at)` across all events in the file, not sum of event durations
- Fixture lives at `scripts/fixtures/pipeline-report-trace.jsonl` (colocated near script + test)
- Non-goals: CI integration, writing results anywhere, historical comparisons, coloured output

## Acceptance criteria

- [ ] `bun run pipeline:report` prints a four-section dashboard: header line, top-5 by tokens, top-5 by duration, per-tool call counts
- [ ] When `.claude/traces/` is missing or empty, outputs exactly `no trace data yet.\n` and exits 0
- [ ] JSONL parsing correctly extracts session count, token sums, and tool call counts
- [ ] Aggregation correctly sums input + output tokens and computes file-span durations
- [ ] `formatReport` output matches the expected section headers and header-line pattern
- [ ] `package.json` registers `"pipeline:report": "bun run scripts/pipeline-report.ts"`
- [ ] All four test groups in `scripts/pipeline-report.test.ts` pass

## Context

`.claude/traces/` accumulates one JSONL file per Claude session when `CLAUDE_CODE_ENABLE_TELEMETRY=1` is set. This script is the first read layer over that telemetry — a zero-dependency dashboard that surfaces cost and duration without any external tooling.
