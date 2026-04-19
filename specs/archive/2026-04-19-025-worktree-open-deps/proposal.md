---
id: 025-worktree-open-deps
title: Worktree-open installs deps post-creation
status: archived
kind: code
gate: scripts/worktree-open.test.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 003-harness-friction-fixes
supersedes: null
archived: '2026-04-19'
---

## Intent

Every new git worktree created by `scripts/worktree-open.ts` starts without
`node_modules`, which blocks the RED commit's pre-commit typecheck on
unresolved imports. Extend the script to run `bun install --frozen-lockfile`
inside the worktree after `git worktree add` succeeds, so /do never needs a
manual install detour.

## Constraints

- Script stays single-file, Bun-only. No new deps.
- Failure mode: leave worktree in place for diagnostic, exit 1.
- Must not skip install based on top-level `node_modules/` presence (a git
  worktree is a separate working tree).
- No changes to `worktree-close.ts`, hooks, or CI workflows.

## Acceptance criteria

- [ ] `scripts/worktree-open.ts` runs `bun install --frozen-lockfile` in the worktree after `git worktree add` succeeds, before the success print
- [ ] `scripts/worktree-open.ts` exits 1 and leaves the worktree in place if install fails
- [ ] `scripts/worktree-open.test.ts` shape case asserts the three-landmark order (`git worktree add` → `bun install --frozen-lockfile` → success print)
- [ ] `scripts/worktree-open.test.ts` behavior case spawns the script against a random tmp slug, asserts `node_modules/@astrojs/cloudflare/package.json` exists, tears down
- [ ] `bun run tasks:verify` green

## Deferred findings

From /retro on 2026-04-19:

- **#2** — Zombie `spec/preview-env-fix` branch and prunable worktree cause
  `worktree-close.ts` to exit 1 on every `git pull`. Fix: detect `prunable`
  via `git worktree list --porcelain` and run `git worktree prune` before the
  cleanup pass, or exit 0 with a warning when cleanup can't locate the
  worktree. Kind: code.
- **#3** — `align` doesn't read `playwright.config.ts` / `package.json`
  scripts, leading spec 024 to ship with `kind`/`gate` deviations from the
  aligned plan. Fix: extend `align` with a pre-Big-Picture "read obvious
  config files" step for /do intents touching testing/build. Kind: workflow
  (or writeup on the align skill). High leverage, medium effort — defer for
  a standalone spec.
- **#4** — Parallel /do runs hit stale-branch on merge (branch protection
  `strict: true`); spec 024 required manual `gh pr update-branch`. Fix: /do
  Step 9 could detect stale-branch failure and auto-retry
  `update-branch` once. Kind: workflow.
- Carry-forward from 023 `findings.md`: (a) main red for 4 merges before
  env-var fix propagated — needs a pre-merge main-health gate. Kind: rule.
  (b) drift detector fires on intentional cross-repo `.claude/plans/**`
  writes — needs allowlist. Kind: code.

## Context

2/2 parallel /do runs on 2026-04-19 (spec 023 preview-pr-write-perm and spec
024 theme-selection) had their RED commits blocked by this exact issue.
Both subagents noted it explicitly in their completion reports. Predecessor
003-harness-friction-fixes closed analogous /do-setup gaps.
