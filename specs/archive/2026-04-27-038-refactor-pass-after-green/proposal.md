---
id: 038-refactor-pass-after-green
title: 'Refactor pass after green for kind:code'
status: archived
kind: workflow
gate: scripts/smoke-implementer-refactor.ts
created: 2026-04-26T00:00:00.000Z
owner: main
depends_on:
  - 027-dual-agent-tdd
supersedes: null
archived: '2026-04-27'
---

## Intent

The current `/do` flow stops at Green: `spec-implementer.md` explicitly forbids opportunistic refactor, leaving GREEN code as whatever the implementer wrote on first pass — never cleaned up. This spec adds the missing Refactor beat to canonical TDD (Red → Green → Refactor) for `kind: code` specs only, inline inside `.claude/agents/spec-implementer.md`. No new subagent. Reuses the existing implementer's hook-enforced gate isolation.

## Constraints

- Refactor pass is scope-bound to the union of all `file_targets` declared in the spec's `tasks.md` — no opportunistic edits to files outside that set.
- After each refactor edit, re-run `tasks:verify`; if it fails, revert that single edit (`git checkout -- <file>` or equivalent) and continue.
- The pass terminates when the implementer judges no further refactor opportunity exists OR all spec `file_targets` have been considered.
- Gate path stays frozen and hook-blocked throughout (`.gate-frozen` sentinel created by spec-judge before implementer is dispatched).
- `kind: rule`, `kind: workflow`, and `kind: writeup` specs are unchanged — their gate fixture/script/markdown IS the deliverable; no refactor pass.
- Refactor pass runs only after `bun run tasks:verify` first goes green — never before.
- If a refactor edit breaks `tasks:verify`, revert that single edit; do NOT enter an unbounded retry loop.
- Cross-cutting refactors that touch files outside `file_targets` become their own spec via `/retro`.
- The implementation edits `.claude/agents/spec-implementer.md` and `scripts/smoke-implementer-refactor.ts` — these two paths are explicitly named so the spec-guard hook authorises writes to them.
- The implementation also edits `.claude/settings.json` to add `Edit(.claude/agents/**)` and `Write(.claude/agents/**)` (plus the worktree-prefixed variants) to the `permissions.allow` array. Without this, the implementer subagent cannot write to `.claude/agents/spec-implementer.md` (Claude Code's permission system blocks before any hook runs). This is a one-time bootstrap; future workflow specs that touch `.claude/agents/**` will inherit the permission.

## Acceptance criteria

- [ ] `.claude/agents/spec-implementer.md` contains a `### Step 6.5 — Refactor pass` section (or equivalent heading) that is gated on `kind: code` only
- [ ] The Step 6.5 section instructs scope-bound refactor: edits limited to the union of `file_targets` from `tasks.md`
- [ ] The Step 6.5 section instructs revert-on-fail: if `tasks:verify` fails after a refactor edit, revert that single edit and continue
- [ ] The Step 6.5 section instructs termination when no further opportunity exists or all targets considered
- [ ] `.claude/settings.json` `permissions.allow` array contains entries authorising `Edit`/`Write` to `.claude/agents/**` (and the `.agentic/worktrees/**/.claude/agents/**` variants)
- [ ] `scripts/smoke-implementer-refactor.ts` exits 0 when all the above invariants are satisfied

## Context

Builds on spec 027-dual-agent-tdd which established the three-subagent TDD architecture (spec-tester, spec-judge, spec-implementer). The refactor beat completes the canonical TDD cycle. Option 1 of three evaluated: inline in spec-implementer.md (chosen). Rejected alternatives: a separate `spec-refactor` subagent (marginal safety gain vs 3x token cost; constitution §2 deterministic-first argues against premature agent multiplication) and deferring to the global `simplify` skill (lives in `~/.claude/`, not in the repo — long-term invariants must live in the repo).
