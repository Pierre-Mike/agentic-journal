---
id: 033-spec-lint-duplicate-ids
title: Spec-lint rejects duplicate spec IDs
status: active
kind: rule
gate: scripts/spec-lint.test.ts
created: 2026-04-24
owner: main
depends_on: []
supersedes: null
---

## Intent

Spec-lint must fail when two specs share the same three-digit numeric prefix (NNN), so parallel `/do` dispatches cannot silently collide on the same number and produce ambiguous history. Currently, three archive folders share `030-*` with the active `030-retro-dormant-worktrees`, meaning the linter would accept a repo state that makes ID-based references ambiguous.

## Constraints

- Check must scan both `specs/active/` and `specs/archive/` (union scope).
- Archive folder names include a date prefix (`YYYY-MM-DD-NNN-slug`); the check must strip the date before extracting NNN.
- Error format: `duplicate spec id NNN: <slug-a>, <slug-b>` — one line per colliding NNN, consistent with existing spec-lint error style.
- Exit 1 via the existing `errors.push(...)` / `process.exit(1)` path when duplicates are found.
- The gate is the existing `scripts/spec-lint.test.ts` (new test case added in RED).
- Do NOT modify `/do` SKILL.md in this spec (allocation-time hardening is deferred).

## Acceptance criteria

- [ ] `spec-lint.ts` detects two active specs with the same NNN and exits 1.
- [ ] `spec-lint.ts` detects an active spec and an archive spec sharing NNN and exits 1.
- [ ] Error message names both slugs: `duplicate spec id NNN: <slug-a>, <slug-b>`.
- [ ] `spec-lint.test.ts` includes a fixture-based test asserting spec-lint exits non-zero on a duplicate-ID scenario.
- [ ] Archive renames resolve existing 030/031/032 collisions so the repo itself passes spec-lint after this spec is implemented.

## Context

Discovered in retrospective: three archive specs (`030-fold-judge-escalation`, `030-skip-judge-rule-workflow`, `030-retro-dormant-worktrees`) share the `030` prefix. This collision proves the linter gap. Related: spec-027 (dual-agent TDD), spec-028 (hook-block-observability), spec-029 (hot-file-saturation).

## Deferred findings

**(a) `/do` Step 3 atomic allocation hardening.** The linter catches collisions post-hoc (at pre-push / CI), but parallel `/do` dispatches can still race at allocation time. True prevention needs an atomic mechanism (advisory lock file, or `mkdir` atomicity). This is a distinct architectural decision, out of scope here.

**(b) Hot-file detector cross-worktree blindness.** The hot-file saturation check in spec-029 operates per-worktree and cannot see files concurrently modified in sibling worktrees. Requires a shared-state or coordination layer — deferred to a follow-on spec.

**(c) ToolBlocked canary verification.** The canary run (spec-012) was found not to exercise the ToolBlocked path introduced in spec-028. A dedicated smoke test or canary variant is needed to assert that hook-block signals propagate correctly end-to-end. Deferred to a follow-on spec.
