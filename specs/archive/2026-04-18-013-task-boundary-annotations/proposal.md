---
id: 013-task-boundary-annotations
title: Task boundary + depends annotations — machine-detectable scope violations
status: archived
kind: rule
gate: scripts/spec-lint.test.ts
created: 2026-04-18T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-18'
---

## Intent

`tasks.md` today carries `agent:`, `depends:`, and `file_targets:` per task, but nothing prevents a task from silently widening its scope at edit time. Add a structural `boundary: [glob, ...]` field per task. `scripts/spec-lint.ts` validates the schema; `scripts/tasks-verify.ts` refuses to mark a task complete if the git diff for that task touches files outside the declared boundary. Strengthens the deterministic-first axiom (constitution §2) — scope drift becomes a mechanical error, not a human judgement call.

## Constraints

- `boundary:` is an array of glob strings (e.g. `[scripts/*.ts]`). `["*"]` is a rare escape hatch.
- Backward compat: tasks WITHOUT a `boundary:` produce a deprecation warning — never an error — so existing in-flight specs don't break.
- TS strict, no `any`, no `as` outside test files, named parameters for 3+ args.
- Pure function `validateBoundary({ task, changedFiles, repoRoot })` — no IO inside the validator.
- Do NOT rewrite archived specs (they're frozen).
- Do NOT integrate the boundary check into `/do` SKILL.md (separate spec).

## Acceptance criteria

- [ ] `specs/_template/tasks.md` documents and demonstrates the `boundary:` field
- [ ] `scripts/spec-lint.ts` validates `boundary:` schema (array of strings) when present
- [ ] `scripts/spec-lint.ts` exports `validateBoundary({ task, changedFiles, repoRoot })`
- [ ] `scripts/spec-lint.test.ts` tests both schema validation and boundary checking with fixtures
- [ ] `scripts/tasks-verify.ts` invokes boundary check on tasks that have it; fails with offending files listed
- [ ] Backward compat: tasks WITHOUT boundary print warning, do not error
- [ ] `bun run check` passes
- [ ] `bun run spec:lint` passes (still passes against existing specs)
- [ ] `bun run tasks:verify` reports green for `013-task-boundary-annotations`

## Context

- `specs/constitution.md` §2 Deterministic-first
- `scripts/spec-complete.ts` — already parses tasks + git diff, natural integration point
- Parallel unlocks: multiple `/do` workers can trust each other to stay in-lane.
