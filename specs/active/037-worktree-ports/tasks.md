# Tasks — 036: Inject process and fs ports into worktree scripts

## Task 1 — Add Process and Fs ports + real adapters to `scripts/_lib.ts`

```yaml
agent: main
depends: []
file_targets:
  - scripts/_lib.ts
boundary:
  - scripts/_lib.ts
```

Export `type Process`, `type Fs`, `realProcess: Process`, and `realFs: Fs` from `scripts/_lib.ts`.

- `Process.run(cmd, opts?)` → `Promise<{ ok: boolean; stdout: string }>` using `Bun.spawn` with stdout piped.
- `Fs.exists(path)` → `boolean` using `existsSync`.
- No changes to existing exports.

## Task 2 — Refactor `scripts/worktree-open.ts`: extract `openWorktree(deps)`, keep `main()` as CLI

```yaml
agent: main
depends: [1]
file_targets:
  - scripts/worktree-open.ts
boundary:
  - scripts/worktree-open.ts
```

Extract the policy logic of `worktree-open.ts` into an exported `openWorktree({ slug, repoRoot, proc, fs })` function that:

- Returns `{ ok: false, reason }` for each precondition violation (not-on-main, uncommitted changes, worktree dir already exists).
- Returns `{ ok: true, path }` on success.
- Never calls `process.exit`.
- Uses the injected `proc` and `fs` instead of direct `Bun.spawn` / `existsSync`.

Keep `main()` as the CLI entry point wired to `realProcess` and `realFs`. Remove the local `sh()` helper (now superseded by the port).

## Task 3 — Refactor `scripts/worktree-close.ts`: extract `closeWorktree(deps)`, keep `main()` as CLI

```yaml
agent: main
depends: [1]
file_targets:
  - scripts/worktree-close.ts
boundary:
  - scripts/worktree-close.ts
```

Extract the policy logic into an exported `closeWorktree({ slug, repoRoot, proc, fs })` function that:

- Returns `{ ok: false, reason }` for each precondition violation (worktree dir missing + branch not merged, uncommitted changes, branch not merged).
- Handles the zombie-reconcile path (dir missing + branch merged → delete branch, return `ok: true`).
- Returns `{ ok: true }` on success.
- Never calls `process.exit`.
- Uses the injected `proc` and `fs` instead of direct `Bun.spawn` / `existsSync`.

Keep `main()` as the CLI entry point. Remove the local `sh()` helper.

## Task 4 — Implement `scripts/smoke-worktree-ports.ts` (real-spawn integration smoke)

```yaml
agent: main
depends: [2, 3]
file_targets:
  - scripts/smoke-worktree-ports.ts
boundary:
  - scripts/smoke-worktree-ports.ts
```

Replace the RED stub with a real integration smoke that:

1. Checks `git status --porcelain` from the repo root; if dirty, prints a skip message and exits 0.
2. Generates a random slug `_smoke-<8-hex-chars>`.
3. Spawns `bun scripts/worktree-open.ts <slug>` in the repo root.
4. Asserts the worktree directory `.agentic/worktrees/<slug>` was created. Exits 1 with a clear message on failure.
5. Fast-forward merges the spec branch into main so `worktree-close` accepts it.
6. Spawns `bun scripts/worktree-close.ts <slug>` in the repo root.
7. Asserts the worktree directory no longer exists. Exits 1 on failure.
8. Resets main back to its pre-smoke SHA (cleanup).
9. Exits 0 on success.
