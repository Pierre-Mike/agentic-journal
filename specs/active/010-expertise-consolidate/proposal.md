---
id: 010-expertise-consolidate
title: Expertise consolidation pass — dedup and prune stale entries
status: active
kind: workflow
gate: scripts/smoke-expertise-consolidate.ts
created: 2026-04-18
owner: main
depends_on: []
supersedes: null
---

## Intent

The `expertise` skill (`.claude/skills/expertise/`) appends learnings to per-domain markdown files (`expertise-refs/*.md`) with no bound. Without consolidation, these files rot: duplicate entries accumulate as different sessions rediscover the same gotcha, and stale entries persist long after their confidence signal has decayed. This spec ships a deterministic consolidation pass — `scripts/expertise-consolidate.ts` — that loads a ref file, deduplicates entries by hash of normalized content, drops entries older than a configurable threshold, and writes the result back. Idempotent: running it twice produces the same output. No LLM call.

## Constraints

- TypeScript strict: no `any`, no `as` outside tests; named parameters for 3+ args
- Pure functions exported from `scripts/expertise-consolidate.ts`: `parseEntries`, `dedupeByHash`, `pruneByAge`, `serialize`
- IO helper `consolidateFile` (not unit-tested, covered by smoke)
- Colocated unit tests `scripts/expertise-consolidate.test.ts` for pure fns
- Smoke pattern mirrors `scripts/smoke-trace-scan.ts`: `mkdtempSync` fixture, `assertTrue` helper, `process.exit(failed > 0 ? 1 : 0)`
- CLI: `bun scripts/expertise-consolidate.ts <path-to-domain-file> [--max-age-days N] [--dry-run]`
  - default `--max-age-days` = 180
  - `--dry-run` prints what would change without writing
- Idempotency: a second run on the same file must yield byte-identical output
- No LLM call — deterministic-first per constitution §2
- Never touch `.claude/skills/expertise/expertise-refs/*.md` from this script at repo level; it operates on any path passed as argv[0]. Existing refs are safe unless explicitly pointed at.

## Non-goals

- LLM-based semantic merging of near-duplicates
- Auto-invoking the consolidator from the `expertise` skill itself (separate spec)
- Editing the `expertise` skill's SKILL.md or schema.md
- Web-fetch or any network IO

## Acceptance criteria

- [ ] `scripts/expertise-consolidate.ts` exists and exports `parseEntries`, `dedupeByHash`, `pruneByAge`, `serialize`, `consolidateFile`
- [ ] `scripts/expertise-consolidate.test.ts` exists; `bun test scripts/expertise-consolidate.test.ts` passes
- [ ] `scripts/smoke-expertise-consolidate.ts` exists and exits 0 (`bun scripts/smoke-expertise-consolidate.ts`)
- [ ] CLI is idempotent — running the consolidator twice on the same fixture yields byte-identical output (asserted in smoke)
- [ ] `bun run check` exits 0
- [ ] `bun run spec:lint` exits 0
- [ ] `bun run tasks:verify` reports `010-expertise-consolidate` green

## Context

- Expertise format reference: `.claude/skills/expertise/schema.md`
- Existing ref example: `.claude/skills/expertise/expertise-refs/conventions.md`
- Pattern reference: `scripts/trace-scan.ts` (pure fns + IO + CLI + colocated test + smoke)
