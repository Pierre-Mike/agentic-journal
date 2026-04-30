---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: b353251afac7
---

## Goal

Add `bun run pipeline:report` — a read-only CLI script (`scripts/pipeline-report.ts`) that parses every `.claude/traces/*.jsonl` file in the repo, aggregates per-session token counts and wall-clock durations, and prints a one-screen dashboard to stdout. This makes existing telemetry visible at a glance from the terminal and serves as the natural feeder for future dashboards or digest agents that need session-level cost/time summaries.

## Big Picture

The traces directory already accumulates one JSONL file per Claude session via `CLAUDE_CODE_ENABLE_TELEMETRY=1`. The new script is a pure read layer over that data — no writes, no side effects.

```
.claude/traces/
  <session-id-1>.jsonl   ← one record per tool call / event
  <session-id-2>.jsonl
  ...
        |
        v
scripts/pipeline-report.ts   ← parses, aggregates, formats
        |
        v
stdout (four sections, one screen)
  - Header summary line
  - Top 5 sessions by token count
  - Top 5 sessions by duration
  - Per-tool call counts

scripts/pipeline-report.test.ts   ← colocated unit tests
  fixture-trace.jsonl             ← small fixture with mixed event types

package.json   ← registers "pipeline:report" script entry
```

## Straightforward Details

### File targets

```
scripts/
  pipeline-report.ts          main entry + JSONL parsing + aggregation + formatting
  pipeline-report.test.ts     colocated Bun test suite
  fixtures/
    pipeline-report-trace.jsonl   fixture JSONL with mixed event types
package.json                  add "pipeline:report": "bun run scripts/pipeline-report.ts"
```

### Output format (stdout, in order)

```
Section 1 — Header line (always present):
  "<N> sessions | <X> total tokens (in: A, out: B) | <D> total wall-clock"

Section 2 — Top 5 sessions by token count:
  label row: "Top 5 by tokens:"
  one line per session: "<session-id-prefix>  <tokens>  <duration>"

Section 3 — Top 5 longest-running sessions:
  label row: "Top 5 by duration:"
  one line per session: "<session-id-prefix>  <tokens>  <duration>"

Section 4 — Per-tool call counts (descending):
  label row: "Tool calls:"
  one line per tool: "<tool>  <count>"
```

### Edge case

```
.claude/traces/ missing or empty
  → print "no trace data yet." and exit 0
  → no other output
```

### JSONL field mapping

```
token counts    : events with input_tokens / output_tokens fields (summed per session)
duration        : events with started_at (ISO timestamp) and duration_ms (number)
                  session wall-clock = max(started_at + duration_ms) - min(started_at)
                  across all events in the file
tool name       : events with a "tool" field (string)
session id      : derived from filename stem (UUID or hash before first dot)
```

### TypeScript constraints (per constitution §5)

```
strict: true, noUncheckedIndexedAccess: true
No any, no as casts outside test file
Immutability by default — readonly arrays and objects
Named params for functions with 3+ args
```

### Testing requirements

```
Test 1 — JSONL parsing
  input  : fixture file with mixed event types (token events, tool events, non-relevant events)
  assert : correct session count, token sums, tool call counts extracted

Test 2 — Aggregation math
  assert : input+output token sums correct
  assert : duration computed correctly from started_at + duration_ms pairs

Test 3 — Output formatting (golden string)
  input  : small fixture producing deterministic output
  assert : full stdout string matches golden snapshot character-for-character

Test 4 — Empty directory edge case
  assert : output is exactly "no trace data yet.\n", exit code 0
```

### Kind and gate

```
kind  : code   (new script + colocated tests; slice-RED TDD applies)
outer gate: scripts/pipeline-report.test.ts   (BDD acceptance — all four test groups pass)
```

## Non-obvious Decisions

### Duration computation: file-span vs sum-of-event-durations

- Recommended: file-span — session wall-clock = max(started_at + duration_ms) - min(started_at) across all events in the file. This matches perceived elapsed time for a session regardless of idle gaps between tool calls.
- Alternative: sum of duration_ms values. Rejected because overlapping or sequential tool calls with idle gaps would undercount or double-count; file-span is simpler and more intuitive for "how long did this session run."

### Session-id display: prefix length

- Recommended: first 8 characters of the filename stem (enough to be recognizable, fits one screen without wrapping at standard terminal widths).
- Alternative: full UUID. Rejected because it makes the table too wide for a one-screen dashboard.

### Fixture location: scripts/fixtures/ vs specs/active/055-.../fixtures/

- Recommended: `scripts/fixtures/pipeline-report-trace.jsonl` — colocated near the script and test, consistent with constitution §8 (colocated tests preferred; gate test lives at its permanent code location, not under specs/).
- Alternative: fixture under the spec folder. Rejected by constitution §8 — no duplicate test trees under specs/.

### Zero-dependency parsing: Bun built-ins vs a JSONL library

- Recommended: plain `Bun.file(...).text()` + `line.split('\n').map(JSON.parse)` — no new dependencies, traces are line-delimited JSON with no escaping edge cases in the fields we care about.
- Alternative: pull in a JSONL library. Rejected — overkill for a simple read-only script; adds a dependency with no benefit given the straightforward format.
