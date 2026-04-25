---
id: "037"
title: Inject process and fs ports into worktree scripts
status: active
kind: code
gate:
  - path: scripts/worktree-open.test.ts
    level: unit
  - path: scripts/worktree-close.test.ts
    level: unit
  - path: scripts/smoke-worktree-ports.ts
    level: integration
created: 2026-04-24
owner: main
depends_on: ["035"]
supersedes: null
---

## Intent

`worktree-open.ts` and `worktree-close.ts` embed their own `sh()` helper and call `Bun.spawn` + `existsSync` directly, making every precondition branch (not-on-main, uncommitted changes, missing/existing directory) reachable only by spawning real git processes against a live repository. This makes the tests slow, stateful, and brittle. By extracting a `Process` port and an `Fs` port — each with a real adapter and an injectable fake — the policy logic of both scripts becomes unit-testable with in-memory fakes, while a thin `main()` CLI shell retains the real adapters for production use. The source-regex shape tests in the existing test files are replaced with direct behavioral assertions against the extracted policy functions.

## Constraints

- `openWorktree(deps)` and `closeWorktree(deps)` must be exported from their respective scripts; `main()` stays as the CLI entry point wired to real adapters.
- `Process` and `Fs` ports + real adapters (`realProcess`, `realFs`) are added to `scripts/_lib.ts`; no new file.
- Policy functions must return a discriminated Result (`{ ok: true; ... } | { ok: false; reason: string }`), never call `process.exit`, never throw.
- Unit tests must contain zero `Bun.spawn` calls.
- `spec-complete.ts` and `tasks-verify.ts` are out of scope — they keep their local `sh()` for now.
- No changes to `package.json`, `bun.lockb`, or tooling configuration.

## Acceptance criteria

- [ ] `openWorktree` returns `{ ok: false, reason: /not on main/ }` when the fake git reports a non-main branch (unit test).
- [ ] `openWorktree` returns `{ ok: false, reason: /uncommit/ }` when the fake git reports uncommitted changes (unit test).
- [ ] `openWorktree` returns `{ ok: false, reason: /already exists/ }` when the fake fs reports the worktree dir already exists (unit test).
- [ ] `openWorktree` returns `{ ok: true, path: <expected> }` on the happy path with a fake that reports clean main and no existing dir (unit test).
- [ ] `openWorktree` reuses an existing branch (skips `git worktree add -b`) when the fake reports the branch ref exists (unit test).
- [ ] `closeWorktree` returns `{ ok: false }` when called with a missing slug / no worktree dir and branch not merged (unit test).
- [ ] `closeWorktree` returns `{ ok: false, reason: /not merged/ }` when the fake git reports the branch is not an ancestor of main and no merged PR exists (unit test).
- [ ] `closeWorktree` returns `{ ok: false, reason: /uncommitted/ }` when the fake git reports dirty status inside the worktree (unit test).
- [ ] `closeWorktree` returns `{ ok: true }` on the happy path: worktree dir present, clean, branch merged (unit test).
- [ ] `smoke-worktree-ports.ts` spawns `bun scripts/worktree-open.ts <slug>` against the real repo and asserts the worktree directory is created, then spawns `bun scripts/worktree-close.ts <slug>` (after marking the branch merged) and asserts cleanup (integration).

## Context

- Spec 026 (`026-worktree-close-reconcile`): introduced the zombie-reconcile logic in `worktree-close.ts` that must be preserved and tested through the port.
- Spec 035 (`035-typed-gates-sibling-tests`): introduced typed gate entries (`path` + `level`) which this spec's gate uses.
