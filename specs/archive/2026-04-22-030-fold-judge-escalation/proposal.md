---
id: 030-fold-judge-escalation
title: Fold judge-rejection escalation into paused report
status: archived
kind: workflow
gate: scripts/smoke-do-no-blocker.ts
created: 2026-04-21T00:00:00.000Z
owner: main
depends_on:
  - 027-dual-agent-tdd
supersedes: null
archived: '2026-04-22'
---

## Intent

Collapse the 3-strike spec-judge rejection path into the existing `paused` Step 10 report variant of `/do`. Eliminate the `blocker.md` sidecar and the third "escalated" report variant. `tester-review.md` (already written by the judge on any FAIL) becomes the single escalation artifact. On 3-strike rejection, `/do` opens a draft PR so the human reviews `tester-review.md` in-context, instead of silently stopping with no PR and three separate sidecar files encoding overlapping state.

## Constraints

- Remove every reference to `blocker.md` from `.claude/skills/do/SKILL.md` and `.claude/agents/spec-judge.md`.
- Remove the Step 10 "escalated" variant from `.claude/skills/do/SKILL.md`. Only `complete` and `paused` remain.
- spec-judge on 3-strike FAIL writes `tester-review.md` with a prominent `## ESCALATION — 3 attempts exhausted` section at the top. It does NOT write `blocker.md`.
- SKILL.md Step 2.5 pseudocode no longer early-returns on judge rejection. Judge rejection falls through to Step 8 with `gh pr create --draft`.
- Non-goal: `.claude/agents/spec-implementer.md` retains its own `blocker.md` escalation (for implementer-stuck-after-3-attempts). This spec only touches the judge path. Same for the `ts-axioms` skill guidance.
- Non-goal: trace-scan / retro script changes — a prior grep confirmed no script reads `blocker.md`, so nothing to rewire.

## Acceptance criteria

- [ ] `.claude/skills/do/SKILL.md` contains zero occurrences of the literal string `blocker.md`.
- [ ] `.claude/agents/spec-judge.md` contains zero occurrences of the literal string `blocker.md`.
- [ ] `.claude/skills/do/SKILL.md` Step 10 does not contain a heading or section labeled `escalated` (case-insensitive).
- [ ] `.claude/agents/spec-judge.md` names `tester-review.md` as the 3-strike-FAIL escalation artifact.
- [ ] Gate script `scripts/smoke-do-no-blocker.ts` asserts all of the above and exits 0 on pass, 1 on fail.

## Context

- Supersedes behavior introduced by archived spec `027-dual-agent-tdd` (judge-escalation path + third report variant).
- Parallel work: a sibling branch edits the same SKILL.md kind→role dispatch. Merge conflict is expected and handled by the human.
