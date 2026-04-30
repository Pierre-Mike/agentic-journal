---
id: 123-slice-runner-self-validation-loop-foundation
title: Slice runner self-validation loop foundation
status: archived
kind: code
gate:
  - path: tests/workflows/slice-runner-loop-deliverables.test.ts
    level: unit
  - path: tests/workflows/slice-runner-validation-loop.test.ts
    level: e2e
created: 2026-04-30T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-30'
---

## Intent

Wrap the slice runner in a local self-validation loop so that typecheck, lint, spec lint, tasks verify, test, and the slice's own gate test all run locally before any push to `auto/X`. On a GREEN run every check passes and the existing push-with-retry logic fires. On a RED run the loop must NOT push; instead it commits WIP to `wip/<slug>-<sha7>`, opens a `slice-stuck` GitHub issue with the failed step's output (capped at 50 KB), and exits 0. This eliminates the 5–10 minute CI-roundtrip cost of catching failures that could be detected locally and is the foundational layer for the broader self-healing pipeline.

## Constraints

- `loop.ts` owns the push-with-retry logic extracted from `slice.yml`; `slice.yml` becomes a thin `bun scripts/slice/loop.ts` invocation.
- `local-ci.ts` is a pure executor: steps + gate path as inputs; spec-parsing belongs in `loop.ts`.
- Each local-ci step writes `/tmp/local-ci/<step>.{stdout,stderr,exit}` artifacts; directory is cleared at loop start.
- WIP branch naming: `wip/<slug>-<sha7>` (HEAD SHA at failure time).
- `slice-stuck` issue body: last 100 lines of stdout + full stderr for the failed step, capped at 50 KB.
- `validateBoundary` runs once, at end-of-loop, after the agent has written its files, before the push decision.
- A boundary violation is treated as a RED path failure.
- No changes to `validateBoundary` function contract.
- Non-goals: fix-agent, doctor.yml, cross-PR track (subsequent specs).

## Acceptance criteria

- [ ] `scripts/slice/local-ci.ts` exists and exports `runLocalCi` and `CI_STEPS`.
- [ ] `scripts/slice/loop.ts` exists and exports `runLoop`.
- [ ] `runLocalCi` runs 6 steps in order, fail-fast, writes `/tmp/local-ci/` artifacts per step.
- [ ] `runLoop` GREEN path calls push-with-retry; RED path commits WIP + opens `slice-stuck` issue, no push.
- [ ] `runLoop` treats a `validateBoundary` violation as RED.
- [ ] `validateBoundary` is called after the slice agent completes (end-of-loop).
- [ ] `slice.yml` invokes `bun scripts/slice/loop.ts` and no longer contains a standalone "Implement slice via Claude" or "Push with retry" step.

## Context

Issue #123. Current `slice.yml` pushes unconditionally after the Claude slice-agent step, delegating failure detection to CI (5–10 min round-trip). This spec adds the local gate between agent completion and push. See alignment.md for decision rationale on push-with-retry placement, wip branch naming, and boundary check timing.
