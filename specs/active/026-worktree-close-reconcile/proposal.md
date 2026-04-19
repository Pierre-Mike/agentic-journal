---
id: 026-worktree-close-reconcile
title: Worktree-close reconciles zombie branches
status: active
kind: code
gate: scripts/worktree-close.test.ts
created: 2026-04-19
owner: main
depends_on:
  - 025-worktree-open-deps
supersedes: null
---

## Intent

`scripts/worktree-close.ts` exits 1 on every `git pull` when a merged spec's
worktree dir is gone but its local branch still exists. Harden the script to
reconcile this state: prune `.git/worktrees/*` admin dirs at the top of
`main()`, and when the worktree dir is missing + the branch is merged, delete
the branch and continue. The post-merge sync hook should stop failing.

## Constraints

- Script stays single-file, Bun-only. No new dependencies.
- Keep the `isMerged` guard before any branch deletion (safety critical for
  single-slug mode and for a user who manually `rm -rf`'d an in-flight
  worktree).
- No changes to `worktree-open.ts`, hooks, or CI workflows.

## Acceptance criteria

- [ ] `scripts/worktree-close.ts` calls `git worktree prune` at the top of `main()` before `listMergedSpecBranches()`
- [ ] `scripts/worktree-close.ts` handles dir-missing + merged-branch by running `git branch -D branch`, returning ok, and continuing the loop
- [ ] `scripts/worktree-close.ts` still refuses (returns error) when dir is missing AND branch is not merged
- [ ] `scripts/worktree-close.test.ts` shape case asserts the prune landmark precedes `listMergedSpecBranches` and the dir-missing path reaches `git branch -D` via an `isMerged` guard
- [ ] `scripts/worktree-close.test.ts` behavior case reproduces the zombie via real git primitives (fast-forward merge into main, `rm -rf` dir), spawns the script, asserts exit 0 + branch gone, resets main in `afterAll`
- [ ] `bun run tasks:verify` green

## Context

Zombie case verified today 2026-04-19: `spec/preview-env-fix` (archived spec
019) has no physical worktree dir, but `git worktree list` shows
`.agentic/worktrees/preview-env-fix … prunable` and the local branch
persists. Every `git pull` triggers exit 1 from the `post-merge` lefthook.
Deferred finding from /retro runs carried through specs 023, 024, 025 (third
carry-forward). Predecessor 025 (worktree-open-deps) just landed in the same
script family and validated the spawn-based behavior-test pattern.
