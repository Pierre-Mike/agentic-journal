# Design — 026-worktree-close-reconcile

## Approach

Two surgical changes to `scripts/worktree-close.ts`:

1. One `await sh(["git", "worktree", "prune"], { silent: true })` at the top
   of `main()`, before `listMergedSpecBranches()`. Idempotent; provides an
   authoritative post-prune snapshot to the rest of the function.
2. A new branch inside `closeOne()` after the `existsSync(worktreePath)`
   check fails: call `isMerged(branch)`; if true, run `git branch -D branch`
   and return `{ ok: true }`. If not merged, keep returning the existing
   error shape (safety).

One new gate file `scripts/worktree-close.test.ts` with a shape case +
a real-git behavior case that sidesteps `gh` by fast-forwarding a tmp
branch into main so it's an ancestor — the local-ancestor path in
`isMerged` short-circuits before any `gh pr list` call.

## Files touched

- `scripts/worktree-close.ts` — prune at top of `main()`; dir-missing +
  merged branch in `closeOne()`.
- `scripts/worktree-close.test.ts` — NEW: shape + behavior cases.
- `specs/active/026-worktree-close-reconcile/` — spec folder.

## Decisions

1. **`git worktree prune` placement**: once at the top of `main()`,
   before `listMergedSpecBranches()`. Idempotent, ~5ms, authoritative
   snapshot. Rejected alternatives: inside every `closeOne()` (churn);
   skip prune entirely (the exact bug).
2. **`isMerged` confirmation before `-D` on dir-missing branch**:
   REQUIRED. The guard is load-bearing for single-slug mode (bypasses
   `listMergedSpecBranches`) and defensive against a manual `rm -rf`.
   Use `-D` (force) to match the existing happy-path close — squash/rebase
   merges leave local branches non-ancestor; `isMerged` already verified
   merged-ness.
3. **Behavior-test hermeticity**: real git primitives. Fast-forward-merge
   the tmp branch into main; reset main in `afterAll`. `isMerged`
   short-circuits on ancestor-of-main — no `gh`, no network, no mocks.

## Out of scope

- Changes to `worktree-open.ts`, hooks, CI workflows.
- Adding a `--dry-run` mode.
- Changing single-slug error shapes.
