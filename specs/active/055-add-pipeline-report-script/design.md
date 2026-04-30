# Design

## Approach

Single TypeScript file `scripts/pipeline-report.ts` with three logical layers:

1. **Parser** — reads all `*.jsonl` files from the traces directory, extracts token counts, tool calls, and timestamps per session.
2. **Aggregator** — computes totals (token sums, duration file-spans) across all sessions.
3. **Formatter** — renders the four-section dashboard to a string; main entry point writes it to stdout.

Colocated Bun test suite (`scripts/pipeline-report.test.ts`) acts as the outer BDD acceptance gate. Per-slice gates exercise each layer in isolation before the full integration gate runs.

## Files touched

- `scripts/pipeline-report.ts` — main entry + JSONL parsing + aggregation + formatting
- `scripts/pipeline-report.test.ts` — outer BDD acceptance gate (all four test groups)
- `scripts/fixtures/pipeline-report-trace.jsonl` — fixture JSONL with mixed event types (used by colocated tests)
- `package.json` — add `"pipeline:report": "bun run scripts/pipeline-report.ts"`

## Decisions

- **Duration: file-span, not sum** — `session wall-clock = max(started_at + duration_ms) − min(started_at)` across all events in the file. Matches perceived elapsed time for a session regardless of idle gaps. Summing `duration_ms` values would under/overcount for sequential or overlapping tool calls.

- **Session-id: 8-char prefix** — first 8 characters of the filename stem. Enough to be recognizable in a table; fits at standard terminal widths without wrapping. Full UUID (36 chars) would make the table too wide.

- **Fixture location: `scripts/fixtures/`** — colocated near the script and test per constitution §8 (gate test lives at its permanent code location, not under `specs/`). Placing it under the spec folder would create a duplicate test tree.

- **Zero-dependency parsing** — `Bun.file().text()` + `split('\n').map(JSON.parse)`. JSONL fields are simple line-delimited JSON with no escaping edge cases in the fields we care about. A JSONL library adds a dependency with zero benefit here.

- **TRACES_DIR env override** — the script reads `process.env.TRACES_DIR ?? ".claude/traces"`. This allows tests (including Test 4 in the outer gate) to point the script at a controlled temp directory without touching the real traces. It is a standard testability affordance, not a feature for users.

## Risks

- JSONL files with malformed lines (non-JSON) could throw on `JSON.parse`. Mitigation: wrap per-line parse in a try/catch and skip unparseable lines silently.
- `.claude/traces/` accumulates across all sessions; large trace counts could slow the script. Non-goal for this spec — the dashboard is intended for human use, not CI automation.

## Out of scope

- Writing results to any file or external system
- CI integration or automated alerting
- Historical comparisons, trend analysis, or per-day aggregation
- Coloured terminal output (ANSI codes)
- Parallelism or streaming for large trace sets
