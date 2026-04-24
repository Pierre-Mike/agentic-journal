---
id: 032-skip-judge-rule-workflow
title: Skip judge for rule and workflow specs
status: archived
kind: workflow
gate: scripts/smoke-do-dispatch-by-kind.ts
created: 2026-04-21T00:00:00.000Z
owner: main
depends_on:
  - 027-dual-agent-tdd
supersedes: null
archived: '2026-04-22'
---

## Intent

Extend the `/do` skill's "skip judge" dispatch branch from `writeup` alone to
also cover `kind: rule` and `kind: workflow`. The AI-judge self-collusion check
(spec 027) pays off when a single agent would write both the test AND the code
that passes it — i.e. for `kind: code`. For rule (lint rule + fixture) and
workflow (smoke script), the gate is a fixture/script; test-implementation
coupling is minimal, and the judge adds roughly 3× subagent token cost for
near-zero safety gain. Today ~70% of specs in `specs/archive/` are workflow or
rule kinds.

## Constraints

- Only edit `.claude/skills/do/SKILL.md`
- Dispatch-chain table must list `code` alone mapped to
  `tester → judge (retry cap 3) → implementer`
- Dispatch-chain table must list `rule | workflow | writeup` (any permutation)
  mapped to `tester → implementer` (skip judge, skip `.gate-frozen`)
- Pseudocode must use `kind !== "code"` as the skip-judge condition (not
  `kind === "writeup"`)
- No changes to `.claude/agents/spec-{tester,judge,implementer}.md` — only the
  dispatch rule changes
- No changes to `.gate-frozen` logic — still skipped for every
  non-`code` kind (same behaviour writeup enjoys today)

## Acceptance criteria

- [ ] SKILL.md dispatch-chain block maps `code` alone to tester → judge → implementer
- [ ] SKILL.md dispatch-chain block maps `rule | workflow | writeup` to tester → implementer
- [ ] SKILL.md pseudocode guards the skip-judge branch with `kind !== "code"`
- [ ] `scripts/smoke-do-dispatch-by-kind.ts` exits 0 (gate green)

## Context

- Builds on `027-dual-agent-tdd` which introduced the three-role dispatch.
- `.gate-frozen` sentinel logic in `.claude/hooks.ts` / `enforce.ts` is
  unchanged; the implementer's gate-edit guard only engages when
  `.gate-frozen` exists, so the fixture/smoke author in rule/workflow keeps
  the freedom that writeup authors already have.
- In-flight specs on the old behaviour complete fine; new specs dispatch per
  the new rule. No migration step needed.
