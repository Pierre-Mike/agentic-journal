---
id: 004-delegate-do-to-subagent
title: Delegate /do to background subagent
status: active
kind: workflow
gate: scripts/smoke-do-delegation.ts
created: 2026-04-16
owner: main
depends_on: [003-harness-friction-fixes]
supersedes: null
---

## Intent

Once the user has confirmed the aligned plan and spec fields, `/do` should dispatch Steps 3–10 to a background subagent via the `Agent` tool with `run_in_background: true` — freeing the main session immediately. The user gets unblocked and is re-engaged only when the subagent reports (PR merged, PR paused, or blocker escalated).

## Constraints

- Main session retains Step 1 (align) and Step 2 (spec fields). Interactive by nature.
- Subagent prompt is self-contained: spec fields + confirmed aligned plan + inlined Steps 3–10 + termination instruction.
- Subagent MUST NOT re-invoke `/do` (no nested align).
- Escalation thresholds unchanged from the existing `/do` skill (3x verify fail, axiom breach, CI red).
- Skill-text-only change; no new scripts, agents, or settings. The `general-purpose` subagent type is used.
- Adding a custom `.claude/agents/do-worker.md` is deferred.

### Non-goals

- A dedicated `do-worker` custom subagent
- Parallel-dispatch orchestration (already covered under existing `## Parallelism`)
- Changes to align, spec-lint, tasks-verify, spec-complete, or hook behaviour

## Acceptance criteria

- [ ] `scripts/smoke-do-delegation.ts` exists and `bun scripts/smoke-do-delegation.ts` exits 0
- [ ] `.claude/skills/do/SKILL.md` contains a new **Step 2.5 — Delegate** section describing the `Agent(run_in_background: true)` handoff
- [ ] `.claude/skills/do/SKILL.md` Steps 3 through 10 are prefixed with a "Executed by the background subagent" header
- [ ] `.claude/skills/do/SKILL.md` Rules block contains a rule stating delegation is mandatory after spec-fields confirmation
- [ ] `bun run spec:lint` exits 0

## Context

Retro on specs 001–003 found that the main session is blocked for ~2–5 minutes per `/do` — CI watch alone takes ~30s, and the work loop runs longer. User's ask: "don't block me when I'm not needed." The `Agent` tool already supports `run_in_background: true` with completion notification, so delegation requires no new infrastructure — only a skill edit plus a smoke gate to lock it in.
