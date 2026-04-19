# Design — 025-worktree-open-deps

## Approach

Single `sh()` call added to `scripts/worktree-open.ts` after the `git
worktree add` success branch, inside the main try path. The invocation
runs `bun install --frozen-lockfile` with `cwd` set to `worktreePath`.
Stream stdout/stderr inherit (not silent) so the user sees install progress
in /do Step 4. The existing success print (`worktree ready at …`) moves to
after the successful install.

`sh()` today accepts `{ silent?: boolean }` with no `cwd`. Extend it
minimally to accept an optional `cwd?: string` parameter, threaded into
`Bun.spawn`. Keeps the single-helper shape and the diff small.

Failure path: print a diagnostic via `console.error` including the
`worktreePath`, then `process.exit(1)`. Do NOT auto-remove the worktree —
a `--frozen-lockfile` failure indicates lockfile drift, and preserving the
scene lets the human diagnose `package.json` vs `bun.lock`.

## Files touched

- `scripts/worktree-open.ts` — install step + optional `cwd` on `sh()`.
- `scripts/worktree-open.test.ts` — NEW, shape + behavior cases.
- `specs/active/025-worktree-open-deps/` — spec folder.

## Decisions

1. **Install between `git worktree add` and success print; no auto-rollback
   on failure.** Success print only fires when the worktree is
   install-ready; /do Step 4 can trust exit code 0. Failure leaves the
   worktree in place for diagnostic.
2. **Shape + behavior in one gate file.** Matches the repo convention
   (every `*.test.ts` holds all cases for its unit). Shape case declared
   first so the fast case fails short on regression.
3. **Real `bun install` against the real lockfile, not mocked.** A mocked
   test would have passed today's broken state. Cost is bounded (~2-5s
   against warm bun global store). `--frozen-lockfile` fails fast on
   lockfile drift and prevents side-effect mutation of `bun.lock`.

## Out of scope

- `worktree-close.ts` changes (deferred finding #2).
- Cross-linking `node_modules` from the main repo into the worktree.
- Caching the bun store across worktrees.
