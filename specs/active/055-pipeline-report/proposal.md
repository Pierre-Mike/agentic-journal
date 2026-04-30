---
id: 055-pipeline-report
title: Add pipeline:report dashboard script
status: active
kind: code
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

Add `bun run pipeline:report` — a read-only CLI script (`scripts/pipeline-report.ts`) that reads every `.claude/traces/*.jsonl` file in the repository, aggregates per-session token counts and wall-clock durations, and prints a compact one-screen dashboard to stdout. The script makes the telemetry that accumulates in `.claude/traces/` visible at a glance from the terminal, closing the observability gap between raw JSONL trace files and actionable insight.

## Constraints

- Read-only: never mutates state; exits 0 in all non-error cases including the empty-traces case
- All business logic in exported pure functions (`parseTraceContent`, `buildReport`, `formatReport`) — no side effects in exports
- JSONL parsed via Zod discriminated unions with `.catch(undefined)` for forward-compatibility; no `any`, no `as` casts outside tests
- `strict: true`, `noUncheckedIndexedAccess: true` throughout
- Unknown event types silently skipped (forward-compatible)
- Colocated unit test (`scripts/pipeline-report.test.ts`) uses inline fixture strings — no disk I/O
- Out of scope: date-range filtering, JSON/HTML output modes, per-agent breakdowns, streaming tail

## Acceptance criteria

- [ ] `scripts/pipeline-report.ts` exports `parseTraceContent`, `buildReport`, `formatReport`
- [ ] `parseTraceContent` parses `token_usage` and `tool_use` events; silently drops unknown types
- [ ] `buildReport` correctly sums `input_tokens`, `output_tokens`, `duration_ms` per session and across all sessions
- [ ] `formatReport` produces the dashboard format (header | Top-5 by tokens | Top-5 by duration | per-tool counts)
- [ ] Empty traces → `"no trace data yet."` output, exit 0
- [ ] `package.json` has `"pipeline:report": "bun scripts/pipeline-report.ts"` under scripts
- [ ] `scripts/pipeline-report.test.ts` covers parse / aggregate / format with golden-string assertion and forward-compat check
- [ ] `bun run pipeline:report` exits 0

## Context

- `.claude/traces/*.jsonl` files are written by the hook system (constitution §9); one file per Claude session
- This is the first local consumer of those files; CI upload is the only prior consumer (spec 054)
- Related GitHub issue: #116
