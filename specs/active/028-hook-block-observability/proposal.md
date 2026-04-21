---
id: 028
title: Emit ToolBlocked trace events for rule friction observability
status: active
kind: code
gate:
  - scripts/trace-scan.test.ts
  - .claude/hooks/enforce.test.ts
created: 2026-04-20
owner: main
depends_on:
  - 008-hook-fail-open
  - 011-trace-shape-v2
  - 013-task-boundary-annotations
supersedes: null
---

## Intent

Make hook-enforced rule friction visible in traces, so `/retro` can measure which rules block which files and tune them against real usage instead of guessing. Today `.claude/hooks/enforce.ts` calls `block(reason)` → `process.exit(2)` silently; `observe.ts::inferStatus()` declares `"blocked"` in its return type but never emits it. A `grep '"status":"blocked"'` across `.claude/traces/` yields zero hits. This spec wires the missing signal: `block()` upgrades to `block(event, reason, filePath)`, emits a `ToolBlocked` line to the session's `.jsonl` before throwing, and `scripts/trace-scan.ts` gains a `Blocks:` section grouped by `(session_id, reason, file)`.

## Constraints

- `observe.ts` stays the single writer to `.jsonl`. `enforce.ts` never touches the file directly.
- `emitBlocked()` must never throw — mirrors the existing `emitTrace()` never-throw contract.
- `block()` emits the trace THEN throws `BlockError` (current exit mechanics preserved). The top-level catch-all in `enforcePreToolUse` continues to translate to `process.exit(2)`.
- Trace shape for `ToolBlocked`: `event: "ToolBlocked"`, `status: "blocked"`, `tool`, `file`, `reason`; no `parent_span_id`, no `duration_ms` (point event, not span).
- `reason` is passed through verbatim — no reformatting.
- `scripts/trace-scan.ts` renders the `Blocks:` section only when ≥1 block exists (symmetry with the `Loops:` / `Drift:` / `Retry storms:` convention).
- Grouping key for render is `(session_id, reason, file)`; count = number of emissions of that triple.
- Order: count desc, then first-seen ascending.
- Non-goal: dashboards, block-rate CI metrics, historical backfill of old traces.
- Non-goal: changing when a block fires — existing rules keep their current semantics.

## Acceptance criteria

- [ ] `.claude/hooks/types.ts`: `block()` signature upgraded to `block(event: ToolEvent, reason: string, filePath: string)` and calls `emitBlocked(...)` before throwing.
- [ ] `.claude/hooks/observe.ts`: exports `emitBlocked(event, reason, tool, filePath)` that appends a `ToolBlocked` line with `status: "blocked"` to `.claude/traces/<session>.jsonl`. Never throws.
- [ ] `.claude/hooks/enforce.ts`: every `block(...)` call site passes `(event, reason, filePath)`.
- [ ] `scripts/trace-scan.ts`: exports `parseBlocked(events)` and `renderBlocks(findings)` or equivalent; `aggregate()` result includes a `blocks` array surfaced by `renderText()` under a `Blocks:` header.
- [ ] `scripts/trace-scan.ts`: when zero blocks exist, no `Blocks:` header is emitted.
- [ ] `scripts/trace-scan.test.ts`: new cases assert the Blocks section is rendered and grouped as `[<sid>] <reason> → <file> ×<count>` for at least one synthetic fixture; also assert empty input → no header.
- [ ] `bun run tasks:verify` green.

## Context

Carries forward retrospective finding F1 from the 2026-04-20 `/retro` cycle (see `findings.md`). Depends on 008-hook-fail-open (established `process.exit(2)` as the only hook-block exit mechanic), 011-trace-shape-v2 (added the `status` enum that already reserves `"blocked"`), and 013-task-boundary-annotations (the `boundary:` field that future work will use to enrich block telemetry). Predecessor spec 027-dual-agent-tdd introduced `.gate-frozen` blocks — this spec makes those blocks (and every other hook-enforced rule) measurable.

Gate widened in revision 2 after spec-judge rubric item 1 (attempt 1) flagged that scanner-only assertions left hook-side ACs (1, 2, 3) unreachable from synthetic `TraceLine[]` fixtures. `.claude/hooks/enforce.test.ts` is now co-frozen so that `block()`'s emit-before-throw contract, `emitBlocked()`'s never-throw invariant, and the single-writer (`observe.ts` only) rule are pinned at the hook seam.
