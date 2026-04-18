---
id: 011-trace-shape-v2
title: Trace shape v2 — span IDs and failure-mode detectors
status: archived
kind: code
gate: scripts/trace-scan.test.ts
created: 2026-04-18T00:00:00.000Z
owner: main
depends_on:
  - 005-trace-scan
supersedes: null
archived: '2026-04-18'
---

## Intent

Today `.claude/hooks/observe.ts` emits flat events `{tool, file, hook_event_name}`. `scripts/trace-scan.ts` aggregates them but cannot detect loops, plan drift, or retry storms — exactly the failure modes `/retro` should target. Extend the trace shape with span hierarchy fields (`session_id`, `span_id`, `parent_span_id`, `started_at`, `duration_ms`, `status`) and add three pure detector functions (`detectLoops`, `detectDrift`, `detectRetryStorm`) to `trace-scan.ts`. `/retro` can then name actual failure patterns instead of only "most-touched files".

## Constraints

- TS strict, no `any`, no `as` outside tests.
- Named parameters for functions with 3+ args.
- Backward compatibility: existing `.claude/traces/*.jsonl` lines MUST continue to parse; missing fields default to `undefined`.
- New types live in `scripts/trace-scan.ts` or `.claude/hooks/types.ts`; do NOT bloat `scripts/_lib.ts`.
- Detector functions are pure: `(events, params) → findings`.
- CLI surface unchanged beyond an optional `--detect loops|drift|retries|all` flag (default: include all summaries in `aggregate`).
- Observe hook never throws; span-id generation failures must not break trace emission.

## Acceptance criteria

- [ ] `.claude/hooks/types.ts` extended with optional fields: `span_id?`, `parent_span_id?`, `started_at?`, `duration_ms?`, `status?`.
- [ ] `.claude/hooks/observe.ts` populates the new fields when it can (span_id always; parent_span_id for PostToolUse; duration_ms on PostToolUse; status inferred).
- [ ] `scripts/trace-scan.ts` exports `detectLoops`, `detectDrift`, `detectRetryStorm` with named-arg signatures.
- [ ] `aggregate()` report includes `loops`, `drift`, `retries` summary fields.
- [ ] `scripts/trace-scan.test.ts` has new unit tests for all three detectors AND a backward-compat test (old-shape jsonl parses into `TraceLine`).
- [ ] All existing tests still pass — no regression.
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for `011-trace-shape-v2`.

## Context

- Depends on `005-trace-scan` (the aggregator this spec extends).
- Out of scope: integrating detectors into `/retro` SKILL.md (separate spec), OTLP export, metrics histograms, cross-session correlation.
