# Retrospective findings — 2026-04-19 (second pass)

Window: last 7 days (2026-04-12 → 2026-04-19)
Signal sources: 23 merged PRs, recent archived specs 015–024, 8 trace sessions.

## 1. worktree-open.ts does not install deps — ACTED ON (this spec)

- **Signal**: 2/2 parallel /do runs on 2026-04-19 (spec 023 preview-pr-write-perm, spec 024 theme-selection) reported the same friction in their Step 10 reports: RED commit blocked by typecheck hook because `@astrojs/*` imports were unresolved in the new worktree. Both required manual `bun install` inside the worktree and retry.
- **Hypothesis**: `scripts/worktree-open.ts` ends with `git worktree add` + a success print. git worktree creates a separate working tree with no `node_modules`. No scaffolding populates it.
- **Proposed action**: Run `bun install --frozen-lockfile` inside the worktree after `git worktree add` succeeds, before the success print. Add a shape + behavior gate at `scripts/worktree-open.test.ts`.
- **Kind**: code
- **Status**: authored as spec 025 (this folder).

## 2. Deferred: zombie spec/preview-env-fix branch blocks sync hook

- **Signal**: `git worktree list` on 2026-04-19 shows `.agentic/worktrees/preview-env-fix … prunable` plus a still-checked-out `spec/preview-env-fix` branch. `worktree-close.ts` (in the post-merge hook) exits 1 on every `git pull`. Observed on both pulls today.
- **Hypothesis**: An earlier spec's merge cleaned up the worktree directory but not the branch, or vice versa. `worktree-close.ts` doesn't reconcile this state.
- **Proposed action**: Call `git worktree prune` before the cleanup pass in `worktree-close.ts`; when a merged branch has no worktree, delete the branch and continue instead of exiting 1.
- **Kind**: code

## 3. Deferred: align doesn't read project config for /do intents

- **Signal**: Spec 024 (theme-selection) shipped with `kind`/`gate` deviations from the aligned plan — the plan called for `tests/e2e/theme.spec.ts` with `kind: code`, but existing `playwright.config.ts` uses `testDir: "./e2e"` + `testMatch: "**/*.e2e.ts"` and `kind: code` dispatches via `bun test` which can't run `@playwright/test`. The subagent landed at `e2e/theme.e2e.ts` with `kind: workflow` + gate `scripts/smoke-e2e.ts`. This deviation was caught at implementation time, not at align time.
- **Hypothesis**: `align`'s conditional-research step checks the open web but not the obvious local config files (`package.json` scripts, `playwright.config.ts`, `astro.config.ts`). For /do intents touching testing/build, these files determine feasibility.
- **Proposed action**: Extend `align` with a "read obvious config files" step that fires when the intent touches testing, bundling, or workflow files. Surface gate-path conflicts BEFORE confirming spec fields.
- **Kind**: workflow (or writeup on the align skill)

## 4. Deferred: parallel /do hits stale-branch on merge

- **Signal**: PR 25 (spec 024) fell behind `main` after PR 24 (spec 023) merged mid-work; branch protection `strict: true` blocked auto-merge. Manual `gh pr update-branch` resolved it. Will recur every time two /do runs are concurrent.
- **Hypothesis**: `/do` Step 9 watches CI but doesn't handle "required to be up-to-date" failures.
- **Proposed action**: In Step 9, detect "not mergeable / out of date" state via `gh pr view --json mergeable,mergeStateStatus` and auto-run `gh pr update-branch`, then resume the watch. Retry at most once to avoid loops.
- **Kind**: workflow

## 5. Carry-forward from 023 findings.md (still deferred)

- **(a)** Main went red for 4 consecutive merges (Deploy 24, 25, 26, 27, 28) before env-var fixes from 019/020 propagated. No gate blocks merging while main's latest Deploy is red. Proposed: pre-merge main-health check querying `gh run list -b main -w "Deploy (production)"`. Kind: rule.
- **(b)** Drift detector fires on intentional cross-repo writes under `**/.claude/plans/**`. Proposed: path-glob allowlist in `scripts/trace-scan.ts`. Kind: code.
