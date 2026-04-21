# Design

## Approach

Hook-block observability is a one-way dataflow addition. `enforce.ts` already decides to block — it just exits silently. We splice a single `emitBlocked()` call into that exit path, which writes a `ToolBlocked` line to the same `.jsonl` trace file `observe.ts` already owns. `trace-scan.ts` gains a reader that groups these lines.

```
PreToolUse (Write|Edit)
  enforce.ts
    rule matches? ─ no ─▶ allow (unchanged)
    rule matches? ─ yes ─▶ emitBlocked(event, reason)  ◀── NEW CALL
                              │
                              ▼
                          observe.ts::emitBlocked()    ◀── NEW EXPORT
                              │
                              ▼
                          .claude/traces/<sid>.jsonl
                            event: "ToolBlocked"
                            status: "blocked"
                            reason: <string>
                            file:   <path>
                              │
                              └─▶ process.exit(2) (via BlockError catch-all)

trace-scan.ts
  parse ok/error events   (existing)
  parse blocked events    ◀── NEW
  render "Blocks:" section grouped by session → reason → file
```

### Trace event shape

A `ToolBlocked` .jsonl line carries:

- `ts`: ISO timestamp
- `session_id`: `<sid>`
- `event`: `"ToolBlocked"` (new event name, distinct from Pre/PostToolUse)
- `agent_id`: `<agent>`
- `span_id`: `<uuid>`
- `status`: `"blocked"` (existing enum value)
- `tool`: `"Write" | "Edit"`
- `file`: `<filePath>`
- `reason`: `<short string from block()>`

No `parent_span_id`, no `duration_ms` — a block is a point event, not a span. `reason` is the exact string passed to `block()` — no reformatting.

### Scanner output format

```
trace-scan.ts prints:
  Trace scan — N session(s), M event(s)
  session <sid> — ...
  Top files (global): ...
  Loops: ...
  Blocks:                                   ◀── NEW SECTION
    [<sid>] <reason> → <file> ×<count>
    ...
```

The Blocks section (including header) is OMITTED when zero blocks exist — same convention as "Loops:". Grouping key is `(session_id, reason, file)`; count is emissions of that triple. Ordered by count desc, then first-seen asc.

## Files touched

- `.claude/hooks/types.ts` — `block()` signature upgraded to `block(event: ToolEvent, reason: string, filePath: string)`; calls `emitBlocked(...)` before throwing.
- `.claude/hooks/observe.ts` — new export `emitBlocked(event, reason, tool, filePath)`; reuses the write-line logic; never throws.
- `.claude/hooks/enforce.ts` — each `block(...)` call site updated to pass `(event, reason, filePath)` — shape of each call site unchanged beyond that.
- `.claude/hooks/spec-guard.ts` — unchanged.
- `scripts/trace-scan.ts` — adds `parseBlocked()` and `renderBlocks()`; widens `TraceLine` to include optional `reason`; extends `TraceScanReport` with a `blocks` array; `aggregate()` populates it; `renderText()` emits the `Blocks:` section when non-empty.
- `scripts/trace-scan.test.ts` — **gate**, frozen by judge. Adds parseBlocked / renderBlocks / aggregate-blocks / render-omission cases. Existing tests preserved.
- `specs/active/028-hook-block-observability/` — proposal.md, design.md, tasks.md, findings.md.

`observe.ts` stays the single writer to `.jsonl`. `enforce.ts` never touches the file directly.

## Decisions

- **Decision 1 — Where the `emitBlocked` call lives: centralized inside `block()` in `types.ts`, NOT at each call site in `enforce.ts`.**
  - `block()` becomes the single point of truth. Any future rule added via `block(...)` automatically gets traced.
  - `block()` signature upgrades from `block(reason: string)` to `block(event: ToolEvent, reason: string, filePath: string)`.
  - Rejected alternative: emit at each of the 4 call sites in `enforce.ts` — drift-prone, forgettable.
  - Rejected alternative: emit in the top-level catch-all — it also catches real bugs; would poison the signal.
- **Decision 2 — Exit mechanics: keep `block()` throw-based; emit trace THEN throw.**
  - `block()` emits the trace, then throws `BlockError` as before. The top-level catch-all in `enforcePreToolUse` still translates that to `process.exit(2)`.
  - `enforce.test.ts` relies on catching `BlockError` — do not break it.
  - Top-level catch should distinguish "intentional block" from "hook bug" in its log message (future-proof — not strictly required by gate but worth mentioning).
  - Rejected alternative: make `block()` inline-exit with `process.exit(2)` — would break test runner, loses block-vs-bug distinction.

## Risks

- **Risk: `block()` signature change breaks existing enforce call sites.** Mitigation: compiler catches every call site; the change is mechanical (add `event`, `filePath` args). `enforce.test.ts` must still pass.
- **Risk: `emitBlocked()` throwing somehow leaks to the hook exit.** Mitigation: wrap the whole body in `try {} catch {}` mirroring `emitTrace()`.
- **Risk: `trace-scan.ts` double-counts blocks if a future PostToolUse also carries `status: "blocked"`.** Mitigation: `parseBlocked` filters on `event === "ToolBlocked"`, not just `status`.

## Out of scope

- Dashboards or visualizations of block frequency.
- Block-rate metrics in CI (any threshold, any alert).
- Historical backfill of pre-028 traces.
- Changing when a block fires — existing rules keep their current semantics.
- Per-reason rule-tuning recommendations (future `/retro` output, not this spec).
