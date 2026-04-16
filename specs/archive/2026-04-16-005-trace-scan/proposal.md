---
id: 005-trace-scan
title: Trace scan aggregator for observability
status: archived
kind: workflow
gate: scripts/smoke-trace-scan.ts
created: 2026-04-16T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-16'
---

## Intent

`/retro` promises to read `.claude/traces/*.jsonl` and surface runtime patterns (events, tools, files) but no script reads them today — retrospectives must be hand-assembled from spec/PR data. This spec builds the read-side: a deterministic aggregator over trace files that future `/retro` runs can rely on. Inputs are the JSONL lines written by `.claude/hooks/observe.ts`; outputs are a structured `TraceScanReport` (sessions scanned, events total, per-session tools/files, global top files) in text or JSON form.

## Constraints

- TypeScript strict: no `any`, no `as` outside tests; named parameters for 3+ args
- Colocated unit tests for pure fns (constitution §8): `parseSince`, `aggregate`, `topN`
- Smoke pattern mirrors `scripts/smoke-harness-fixes.ts` (`mkdtempSync`, `assertTrue`, `process.exit(failed > 0 ? 1 : 0)`)
- CLI: `bun scripts/trace-scan.ts [--since 7d|YYYY-MM-DD] [--session <id>] [--format text|json] [--traces-dir <path>]`
  - `--since 7d` → cutoff = now − 7 days; `--since 2026-04-14` → start-of-day UTC; omitted → all-time
  - `--session <id>` → only that `<id>.jsonl`
  - `--format text` (default) or `json`
  - `--traces-dir <path>` → default `./.claude/traces`
- Exported pure fns: `parseSince(input, now)`, `aggregate(events)`, `topN(counts, n)`
- IO helpers (not unit-tested, covered by smoke): `loadTraces(dir, sessionFilter)`, `renderText(report)`, `run(argv)` — `await run(process.argv)` guarded by `if (import.meta.main)`
- Read-all in memory (traces currently ~16 KB); header comment flags readline switch if files exceed ~5 MB
- Silently skip malformed JSON lines (symmetry with `observe.ts` never-throw contract)
- Types live inside `scripts/trace-scan.ts`; do NOT bloat `_lib.ts`
- Do NOT invent block/failure counts — hook `block()` exits before `PostToolUse`, so those events aren't in the data

## Non-goals

- Widening `emitTrace`'s payload (future spec)
- Block/failure detection (not in current trace shape)
- Integrating the aggregator into `/retro` itself (deferred)

## Acceptance criteria

- [ ] `scripts/trace-scan.ts` exists and exports `parseSince`, `aggregate`, `topN`, `loadTraces`, `renderText`, `run`
- [ ] `scripts/trace-scan.test.ts` exists and passes under `bun test scripts/trace-scan.test.ts`
- [ ] `scripts/smoke-trace-scan.ts` exists and exits 0 (`bun scripts/smoke-trace-scan.ts`)
- [ ] `specs/active/005-trace-scan/findings.md` exists (retro audit trail)
- [ ] `bun run spec:lint` exits 0
- [ ] `bun run tasks:verify` reports `✓ 005-trace-scan (workflow) — 1 workflow smoke(s) pass`

## Context

- Spawned by `/retro` (window 2026-04-09 → 2026-04-16). Findings in `findings.md`.
- Write-side: `.claude/hooks/observe.ts`, event types: `.claude/hooks/types.ts`
- Smoke pattern reference: `scripts/smoke-harness-fixes.ts`
