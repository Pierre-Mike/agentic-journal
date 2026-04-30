---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: f58359d22b0e
---

## Goal

Add `scripts/pipeline-report.ts`, registered as `bun run pipeline:report` in `package.json`, that reads `.claude/traces/*.jsonl` files using the existing `TraceScanReport` infrastructure from `scripts/agentic/trace-scan.ts` and prints a compact, human-readable summary of pipeline telemetry: sessions scanned, total events, top tools, top files touched, and any detected anomalies (loops, drift, retries, blocks). This gives the morning digest and `/retro` workflows a quick at-a-glance report without invoking the full verbose trace-scan CLI, and fills the gap left by issue #107 as a complementary "badge-style" report that aggregates trace telemetry into a single structured output line per dimension — matching the pattern established by `auto:status` (spec 052) and `auto:age` (spec 053).

## Big Picture

The repo already has the trace aggregation machinery; `pipeline:report` is a thin read-side consumer that wraps it into a scripted report entry point.

```
.claude/traces/*.jsonl
        │
        ▼
scripts/agentic/trace-scan.ts   ← loadTraces(), aggregate(), detect*()
        │                          (existing, spec 005 + spec 011)
        ▼
scripts/pipeline-report.ts      ← NEW: formats TraceScanReport into a
        │                          compact multi-line report
        ▼
stdout                          ← consumed by morning-digest / CI / human
```

Sibling scripts in `scripts/` (same pattern):

```
scripts/auto-status.ts     → auto:status   (PR state tally)
scripts/auto-age-buckets.ts → auto:age      (PR age buckets)
scripts/pipeline-report.ts  → pipeline:report  (trace telemetry summary)
```

## Straightforward Details

### File layout
- New file: `scripts/pipeline-report.ts` — main script + exported pure formatter
- New test: `scripts/pipeline-report.test.ts` — unit tests for the formatter (bun:test)
- New BDD test: `tests/pipeline-report-bdd.test.ts` — integration test verifying the script runs and exits 0

### Script registration
- `package.json` gains `"pipeline:report": "bun scripts/pipeline-report.ts"` under `scripts`

### Exported pure functions (for test isolation)
```
formatReport(report: TraceScanReport): string
```
- Accepts a `TraceScanReport` (already defined in `scripts/agentic/trace-scan.ts`)
- Returns a multi-line string; one labelled section per dimension
- No subprocess calls; no I/O inside this function

### Output shape (formatReport)
```
sessions: N  events: M
top tools: Write(K), Read(J), Bash(I)
top files: path/a(K), path/b(J)
anomalies: loops=X drift=Y retries=Z blocks=W
```
- All counts on single lines; sections separated by newlines
- Empty traces produce a valid zero-state output, not an error
- `main()` calls `loadTraces()` + `aggregate()` from trace-scan, then prints `formatReport(report)`

### Dependencies
- Imports from `scripts/agentic/trace-scan.ts`: `loadTraces`, `aggregate`, `TraceScanReport`
- No new npm dependencies
- `--traces-dir` optional CLI flag (default `".claude/traces"`) passed through to `loadTraces`

### TypeScript constraints (matching constitution §5)
- `strict: true`, `noUncheckedIndexedAccess: true`
- No `any`; no `as` casts outside tests
- Named parameters for functions with 3+ args

### Testing strategy
- Unit tests (`scripts/pipeline-report.test.ts`): fixture `TraceScanReport` objects, exact string equality on `formatReport`; covers zero-state, single-session, multi-session with anomalies
- BDD test (`tests/pipeline-report-bdd.test.ts`): spawns `bun scripts/pipeline-report.ts` and asserts exit 0 + non-empty stdout; uses an injected `--traces-dir` pointing to a temp dir with fixture jsonl

### Gate shape (kind: code, two gates)
```yaml
gate:
  - path: scripts/pipeline-report.test.ts
    level: unit
  - path: tests/pipeline-report-bdd.test.ts
    level: integration
```

## Non-obvious Decisions

### Where does the new script live — scripts/ root vs scripts/agentic/?

⭐ Recommended: `scripts/pipeline-report.ts` at the `scripts/` root, consistent with `auto-status.ts` and `auto-age-buckets.ts`. The `scripts/agentic/` sub-directory contains agent-infrastructure scripts (`trace-scan.ts`, `tasks-verify.ts`, `morning-digest.ts`) that the pipeline scripts call. `pipeline-report.ts` is a consumer/reporter, not infrastructure — so it belongs at the root level alongside the other pipeline-facing scripts.

❌ Alternative — `scripts/agentic/pipeline-report.ts`: would be inconsistent with the established pattern; `agentic/` is reserved for agent plumbing, not output-facing scripts.

---

### Should formatReport produce one line (badge style) or multi-line?

⭐ Recommended: multi-line (one section per dimension). `auto:status` and `auto:age` are single-line because they aggregate a single dimension (PR state or age). Trace telemetry has four orthogonal dimensions (volume, tools, files, anomalies); a single line would truncate useful information. Multi-line keeps each dimension readable while remaining machine-parseable by the morning digest.

❌ Alternative — single compact line: loses anomaly detail (loops/drift/retries/blocks counts would be illegible); the morning digest post-processor can already handle multi-line script output.

---

### Should the script re-implement loadTraces/aggregate, or import from trace-scan.ts?

⭐ Recommended: import directly from `scripts/agentic/trace-scan.ts`. The aggregation logic (malformed-line skipping, session grouping, detector runs) is already correct and tested. Duplicating it would violate DRY and risk behavioral divergence.

❌ Alternative — standalone re-implementation: unnecessary duplication; defeats the point of spec 005/011 having built a reusable aggregator.
