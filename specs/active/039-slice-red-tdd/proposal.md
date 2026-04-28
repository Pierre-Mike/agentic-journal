---
id: 039-slice-red-tdd
title: Slice-RED TDD with judge per slice
status: active
kind: workflow
gate: scripts/smoke-slice-red.ts
created: 2026-04-28T00:00:00.000Z
owner: main
depends_on:
  - 027-dual-agent-tdd
  - 032-skip-judge-rule-workflow
  - '035'
  - 038-refactor-pass-after-green
supersedes: null
---

## Intent

Convert `/do` from batch-RED (all gate tests authored upfront before any implementation) to a per-slice red-green-refactor TDD cycle. Each task in `tasks.md` declares its own `gate:` field; `/do` runs an N-iteration loop where one slice = one full micro-cycle (tester writes test → judge reviews → implementer makes green → refactor). This restores genuine TDD discovery: test N+1 is informed by what was learned implementing N, rather than all tests being speculated in advance.

## Constraints

- Per-task `gate:` field and slice sentinels (`.gate-frozen-N`) apply to `kind: code` specs only; rule/workflow/writeup keep the legacy single-gate batch-RED path.
- Bare `.gate-frozen` sentinel is inert — never created, never read by scripts or hooks after this change.
- `spec:complete` requires all `.gate-frozen-1` through `.gate-frozen-N` sentinels present for `kind: code` specs; legacy single-gate path for other kinds.
- `spec-lint` must validate per-task gate uniqueness and contiguity (1..N, no gaps) for `kind: code` specs.
- `tasks-verify` must skip unfrozen slices (RED is correct for an unfrozen slice) and only enforce slices that are frozen.
- Hook (`enforce.ts`) must enforce per-slice via `.gate-frozen-N` and treat bare `.gate-frozen` as inert.
- Refactor pass (from spec 038) shifts from end-of-spec to end-of-slice scope for `kind: code` specs.
- Non-goals: auto-unfreezing earlier slices; migrating archived specs; changing the judge's scope or authority model.

## Acceptance criteria

- [ ] `scripts/_lib.ts` exports `taskGates(specDir)` returning `{ordinal, gatePath, frozen}[]`
- [ ] `specs/_template/tasks.md` and `specs/_template/proposal.md` updated with per-task `gate:` field documentation
- [ ] `spec-lint.ts` validates per-task gate: present, unique, contiguous 1..N for `kind: code`; skips for non-code
- [ ] `tasks-verify.ts` is slice-aware: frozen slices enforced, unfrozen slices skipped, scaffold (no frozen slices) returns green
- [ ] `spec-complete.ts` requires all `.gate-frozen-N` sentinels for `kind: code`; legacy path for non-code
- [ ] `enforce.ts` uses `findSliceForPath` to block edits to gate files with `.gate-frozen-N`; bare `.gate-frozen` is inert
- [ ] `/do` SKILL.md updated: Step 5 scaffold-only, Step 6 per-slice loop with tester → judge → implementer per task
- [ ] spec-tester agent docs updated to describe scaffold mode vs slice mode
- [ ] spec-judge agent docs updated to describe per-slice review with `.gate-frozen-N` sentinel
- [ ] spec-implementer agent docs updated: per-slice GREEN + refactor, `slice-revision-blocker.md` protocol
- [ ] `specs/constitution.md` §4 updated with slice-RED rules and kind:code-only gating
- [ ] `scripts/smoke-slice-red.ts` passes all assertions

## Context

- Spec 027-dual-agent-tdd: introduced the tester/judge/implementer separation and `.gate-frozen` sentinel
- Spec 032-skip-judge-rule-workflow: established that judge is only needed for `kind: code`
- Spec 035-typed-gates-sibling-tests: introduced typed gate entries `{path, level}` for `kind: code`
- Spec 038-refactor-pass-after-green: added refactor pass after implementation

Research background: AgentCoder (arxiv 2312.13010), Code-A1 (arxiv 2603.15611) show 8–11pp pass@1 improvement from role separation in TDD; per-slice discovery enables test N+1 to be informed by what was learned building N.
