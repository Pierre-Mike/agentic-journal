---
id: 051-intent-status-in-flight-auto-branches
title: Add intent:status script for in-flight auto branches
status: active
kind: code
# Outer gate (BDD, integration-level) is tests/intent-status-bdd.test.ts — written RED at scaffold.
# Per-slice gates are declared in tasks.md and written in the per-slice loop.
gate:
  - path: scripts/intent-status.test.ts
    level: unit
  - path: tests/intent-status-bdd.test.ts
    level: integration
created: 2026-04-30
owner: main
depends_on: []
supersedes: null
---

## Intent

Add a read-only Bun script `scripts/intent-status.ts` (registered as `intent:status` in `package.json`) that queries `git for-each-ref` on `refs/remotes/origin/auto/` to find every `auto/<n>-<slug>` branch, then prints a sorted, human-readable table showing the issue number, slug, and age since the branch's last commit. This closes the observability gap introduced when `intent.yml` moved in-flight work to `auto/*` branches before scaffold lands — mirroring what `bun run spec:status` provides for active spec directories.

## Constraints

- No network call: reads `refs/remotes/origin/auto/` (local remote-tracking copy), not `git ls-remote`
- No new dependencies: uses only `Bun.$` / `Bun.spawn` and Node built-ins
- Script lives at `scripts/intent-status.ts` (flat, not a subdirectory) consistent with `scripts/issue-options.ts`
- Registered as `intent:status` to match the `spec:status` naming pattern
- `formatAge`, `parseBranch`, and `formatTable` are exported pure functions so they can be tested without spawning a subprocess
- Test file `scripts/intent-status.test.ts` mocks the subprocess — CI never needs network access
- Empty state prints `no in-flight intents.` and exits 0

## Acceptance criteria

- [ ] `scripts/intent-status.ts` exists and exports `formatAge`, `parseBranch`, and `formatTable`
- [ ] `formatAge(seconds)` returns `"<N>d <H>h"` with hours space-padded to 2 chars
- [ ] `parseBranch(ref)` extracts issue number and slug from `origin/auto/<n>-<slug>` or `refs/remotes/origin/auto/<n>-<slug>` refs; returns `null` for non-matching refs
- [ ] `formatTable(entries)` returns `"no in-flight intents."` for an empty list; otherwise returns header + rows sorted oldest-first (largest `ageSeconds` first)
- [ ] `package.json` has `"intent:status": "bun scripts/intent-status.ts"` under `scripts`
- [ ] `scripts/intent-status.test.ts` covers `formatAge` (zero/single/double-digit hours), `parseBranch` (happy path + null cases), `formatTable` (empty + ordering), and mocks the subprocess for an integration test of the full output
- [ ] Running `bun run intent:status` exits 0 (no crash when remote refs are absent)

## Context

- `spec:status` (`scripts/spec/spec-status.ts`) is the existing model: reads `specs/active/` and prints a human-readable table. `intent-status.ts` provides the same for pre-scaffold in-flight intents.
- `intent.yml` creates `auto/<n>-<slug>` branches; these are the only artifact of an in-flight intent before the spec-tester scaffolds `specs/active/`.
- Related issue: #93.
