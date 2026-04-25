# Design — 036: Inject process and fs ports into worktree scripts

## Approach

### Port shape

```ts
// In scripts/_lib.ts

type Process = {
  run(cmd: readonly string[], opts?: { cwd?: string }): Promise<{ ok: boolean; stdout: string }>;
};

type Fs = {
  exists(path: string): boolean;
};
```

`Process.run` captures stdout always (cheap), returns `{ ok: boolean; stdout: string }`. `ok` is true iff exit code is 0.

`Fs` is intentionally minimal — only `exists` (wrapping `existsSync`) is needed by either policy. Adding more methods is a later spec.

### Real adapters

`realProcess: Process` wraps `Bun.spawn` with stdout piped to a string. Exported from `_lib.ts`.

`realFs: Fs` wraps `existsSync`. Exported from `_lib.ts`.

### Policy signature

```ts
// worktree-open.ts
export async function openWorktree(deps: {
  slug: string;
  repoRoot: string;
  proc: Process;
  fs: Fs;
}): Promise<{ ok: true; path: string } | { ok: false; reason: string }>

// worktree-close.ts
export async function closeWorktree(deps: {
  slug: string;
  repoRoot: string;
  proc: Process;
  fs: Fs;
}): Promise<{ ok: true } | { ok: false; reason: string }>
```

Policy functions never call `process.exit` or throw. They return a discriminated Result matching the existing `GateResult` dialect used in `tasks-verify.ts`.

### CLI shell

`main()` in each script parses `process.argv`, calls policy with `{ proc: realProcess, fs: realFs }`, prints results, and calls `process.exit(ok ? 0 : 1)`.

### Fake adapter strategy (test-local)

Tests define `fakeProcess(scripted: Record<string, { ok, stdout }>)` keyed by the joined command string (e.g. `"git status --porcelain"`). Any unscripted command defaults to `{ ok: true, stdout: "" }`. `fakeFs({ existing: string[] })` tracks a set of existing paths. Both fakes are defined inline in the test files — not exported, not shared.

## Files touched

| File | Change |
|------|--------|
| `scripts/_lib.ts` | Add `Process` type, `Fs` type, `realProcess`, `realFs` exports |
| `scripts/worktree-open.ts` | Extract `openWorktree(deps)`, keep `main()` as CLI shell |
| `scripts/worktree-close.ts` | Extract `closeWorktree(deps)`, keep `main()` as CLI shell |
| `scripts/worktree-open.test.ts` | Rewrite with fake-adapter unit tests (RED gate) |
| `scripts/worktree-close.test.ts` | Rewrite with fake-adapter unit tests (RED gate) |
| `scripts/smoke-worktree-ports.ts` | New integration smoke (RED gate, stub today) |

## Non-obvious decisions

1. **Port location**: keep in `_lib.ts` (no new `scripts/process.ts`). Two consumers, ~30 lines of port code; separating is premature.

2. **Filesystem dependency**: inject `Fs` port (not replace with `git worktree list` parse — orphaned-dir case differs). Keep `Fs` tiny: just `exists`.

3. **Policy return shape**: discriminated Result `{ ok: true, path } | { ok: false, reason }`. Never throw, never `process.exit` from the policy. Matches existing `GateResult` dialect (`tasks-verify.ts`).

## Out of scope

- `spec-complete.ts` and `tasks-verify.ts` — keep their local `sh()` helpers for now; migration is a follow-up spec.
- Gate registry changes.
- The real-spawn smoke harness from the original candidate #4 (full e2e with network) — the integration smoke covers the same intent locally.
