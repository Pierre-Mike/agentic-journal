---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 8cd38f5e1ae5
---

## Goal

Add `bun run pipeline:report` — a read-only CLI script (`scripts/pipeline-report.ts`) that reads every `.claude/traces/*.jsonl` file in the repository, aggregates per-session token counts and wall-clock durations, and prints a compact one-screen dashboard to stdout. The script makes the telemetry that accumulates in `.claude/traces/` visible at a glance from the terminal, closing the observability gap between raw JSONL trace files and actionable insight. It is the natural feeder for future dashboards without introducing any mutations or side effects.

## Big Picture

The repo's hook system (constitution §9) already emits one JSONL per Claude session to `.claude/traces/`. Until now, that data had no consumer other than the CI upload artifact. This spec adds the first local consumer: a pure aggregator that reads those files and formats a summary.

```
.claude/traces/
  <session-id-1>.jsonl   ──┐
  <session-id-2>.jsonl   ──┤──► scripts/pipeline-report.ts ──► stdout dashboard
  ...                    ──┘         │
                                     │  reads only; no writes
package.json
  "pipeline:report": "bun scripts/pipeline-report.ts"

scripts/pipeline-report.test.ts
  fixture trace JSONL ──► unit tests for parse / aggregate / format
```

Flow inside the script:

```
glob(".claude/traces/*.jsonl")
  │
  ├─ empty → print "no trace data yet." → exit 0
  │
  └─ each file → parse JSONL lines → filter to known event types
       │
       ├─ accumulate: session token totals (in + out), duration_ms
       │
       └─ format:
            Header line
            Top-5 by token count
            Top-5 by duration
            Per-tool call counts (descending)
```

## Straightforward Details

### File layout

```
scripts/
  pipeline-report.ts          ← main entry + CLI (no framework)
  pipeline-report.test.ts     ← colocated unit tests + fixture JSONL inline or imported
package.json                  ← add "pipeline:report" script key
```

### Output format (stdout)

```
<N> sessions | <X> total tokens (in: A, out: B) | <D> total wall-clock

Top 5 by tokens:
  <session-id-prefix>  <tokens>  <duration>
  ...

Top 5 by duration:
  <session-id-prefix>  <tokens>  <duration>
  ...

Per-tool call counts:
  <tool>  <count>
  ...
```

- Session-id-prefix: first 8 chars of the session ID from the filename stem
- Duration display: human-readable (e.g., `2m 14s`); computed from `started_at` + `duration_ms` fields in trace events
- Token counts: sum of all `input_tokens` / `output_tokens` across all events in a session file
- Counts per tool: sum across all sessions

### JSONL event shape (observed in .claude/traces/)

```
{ "type": "tool_use", "tool": "<name>", "session_id": "...", ... }
{ "type": "token_usage", "input_tokens": N, "output_tokens": N,
  "session_id": "...", "started_at": "<ISO>", "duration_ms": N, ... }
```

Unknown event types are silently skipped (forward-compatible).

### TypeScript constraints (constitution §5)

- `strict: true`, `noUncheckedIndexedAccess: true`
- No `any`, no `as` casts outside test file
- All parsed JSONL validated through Zod schemas or explicit type-narrowing discriminants before use
- Immutable intermediate aggregation objects (`readonly`, `as const` where applicable)

### Test coverage requirements

- JSONL parsing: fixture file with mixed event types (token_usage, tool_use, unknown); assert only known types counted
- Aggregation math: verify token sums (in + out separately), duration computation
- Output formatting: golden-string assertion on small fixture's complete formatted output
- Empty/missing directory: assert `"no trace data yet."` output, exit 0

### Package.json registration

```json
"pipeline:report": "bun scripts/pipeline-report.ts"
```

Added alongside existing `pipeline:*` / `auto:*` / `spec:*` entries.

### Out of scope

- Filtering by date range, branch, or agent
- JSON or HTML output modes
- Per-agent breakdowns (per-tool only)
- Streaming / live tail of trace files

## Non-obvious Decisions

### Zod vs manual type narrowing for JSONL parsing

⭐ Recommended: Use Zod discriminated unions for each known event type, with a catch-all branch that drops unknown shapes.

Rationale: the JSONL format is not formally versioned; new event types will appear as the hook system evolves (constitution §9). A Zod discriminated union with `.catch(undefined)` gives a compact, auditable schema that auto-handles forward-compatibility without `any` casts. It also satisfies the `noExplicitAny` constraint without ceremony.

Alternatives rejected:
- Manual `if (obj.type === "token_usage")` narrowing: works but verbose; no schema documentation; harder to extend when a new event type needs aggregation
- `JSON.parse as SomeType` cast: violates constitution §5 (`as` casts banned outside test files)

### Inline fixture vs separate `.jsonl` fixture file

⭐ Recommended: Inline a small fixture as a template literal string in `pipeline-report.test.ts` (passed to the parser as a string, no disk reads in unit tests).

Rationale: keeps tests self-contained, avoids fixture file drift, and satisfies constitution §8 (colocated tests). The golden-string assertion is then a simple `expect(format(aggregate(parse(fixture)))).toBe(expected)` call with no I/O.

Alternatives rejected:
- Separate `scripts/__fixtures__/trace.jsonl`: extra file to maintain; test must do disk I/O; path resolution brittle across worktrees
- Reading from actual `.claude/traces/` in tests: non-deterministic; would differ across machines and CI runs

### Session ID display length (prefix chars)

⭐ Recommended: 8 characters.

Rationale: session IDs in the existing telemetry are UUID-like (32+ hex chars). 8 chars provides sufficient visual distinctiveness for the top-5 lists without wrapping typical terminal widths. Consistent with how the `auto-age-buckets.ts` script truncates branch identifiers.

Alternatives rejected:
- Full UUID: wraps terminals narrower than 120 columns; no added value for a summary view
- 12 chars: minor improvement in uniqueness, but 8 is already collision-resistant for the small N (typical trace directories hold fewer than 200 sessions)
