---
id: 044-bdd-outer-gate
title: BDD outer acceptance gate
status: active
kind: workflow
gate: scripts/check-outer-gate-flow.ts
created: 2026-04-28
owner: main
depends_on: [043-persist-alignment-mailbox]
supersedes: null
---

## Intent

Add a top-level (BDD-style) acceptance gate per spec, distinct from per-slice gates, so each spec has a single behavioral check that proves "done." This catches integration gaps where individual slice gates pass but the spec's stated outcome doesn't.

## Constraints

- Reuse existing `gate:` field in `proposal.md` frontmatter as the outer gate (no new field)
- Per-slice gates (`gate:` per task in `tasks.md`) continue unchanged for `kind: code` specs
- Outer gate scaffolded at Step 5 by spec-tester for `kind: code` (currently skipped)
- Outer gate reviewed by spec-judge against `alignment.md` at scaffold time
- `spec:complete` enforces BOTH outer gate AND per-slice gates before archive
- For `kind: rule | workflow | writeup` — no functional change; outer gate is the only gate (no slices)

## Acceptance criteria

- [ ] A sample `kind: code` spec scaffolds with its outer gate file present and RED
- [ ] `spec:complete` refuses to archive if the outer gate is RED even when all per-slice gates are frozen (`.gate-frozen-N` present)
- [ ] Outer gate is validated using `alignment.md` as source of truth
- [ ] `spec-tester` writes outer gate at Step 5 for `kind: code`
- [ ] `spec-judge` reviews outer gate at scaffold time
- [ ] `spec:complete` verifies outer gate before archive

## Context

Builds on spec 043 (persist-alignment-mailbox) which ensures `alignment.md` is available for gate validation. The outer gate is scoped to `alignment.md` — it tests the spec's integrated behavior as stated in the alignment document. Per-slice gates remain scoped to individual task boundaries.

Files touched: `.claude/agents/spec-tester.md`, `.claude/agents/spec-judge.md`, `.claude/skills/do/SKILL.md`, `scripts/spec-complete.ts`, `specs/constitution.md`.
