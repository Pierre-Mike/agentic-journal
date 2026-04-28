---
id: 045-replan-hook
title: post-slice re-plan hook
status: active
kind: workflow
gate: scripts/smoke-replan-flow.ts
created: 2026-04-28
owner: main
depends_on: [044-bdd-outer-gate]
supersedes: null
---

## Intent

After each slice's refactor commit, run a cheap haiku-model subagent that diffs the slice's implementation against `design.md` and patches `tasks.md` if downstream slices are invalidated. Closes the feedback loop where slice 1 implementation often reveals slice 2 was mis-specified.

## Constraints

- No rewriting `design.md` (except APPEND-only to a "Replanning notes" section)
- Replanner runs after every slice's refactor commit, before next slice's tester dispatch
- Replanner can ONLY edit `tasks.md` and append to `design.md` (scope guard enforced)
- Soft escalation: if deviation is too significant, write `replan-escalation.md`, exit 0, continue
- Commit convention: `replan(<id>): N+1` where N+1 is the next slice index patched

## Acceptance criteria

- [ ] New agent `.claude/agents/spec-replanner.md` exists with model:haiku and scoped tool allowlist
- [ ] `/do` Step 6 per-slice loop dispatches replanner after refactor commit, before next slice's tester
- [ ] `scripts/smoke-replan-flow.ts` gate validates the flow (RED initially, GREEN after implementation)
- [ ] `specs/constitution.md` documents the replanner role and scope guard

## Context

Builds on spec 044's outer gate enforcement. The replanner is a feedback hook that keeps `tasks.md` synchronized with implementation reality. Related: spec 040 (slice-RED TDD), spec 041 (CI integrity).
