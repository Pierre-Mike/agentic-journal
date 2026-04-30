---
id: 053-add-age-buckets-script-summarizing-auto-branch-age
title: 'Add age-buckets script summarizing auto branch age'
status: active
kind: code
gate:
  - path: scripts/auto-age-buckets.test.ts
    level: unit
  - path: tests/auto-age-buckets-bdd.test.ts
    level: integration
created: 2026-04-30
owner: main
depends_on: []
supersedes: null
---

## Intent

Add `scripts/auto-age-buckets.ts`, registered as `bun run auto:age` in `package.json`, that queries open `auto/*` pull requests via `gh pr list --state open --json headRefName,createdAt` and prints a single summary line bucketing them by age: `< 1h`, `1–24h`, and `> 24h`. Complements `auto:status` (state breakdown) and `intent:status` (full list) by surfacing at a glance whether any branches are stuck (> 24h without merging).

## Constraints

- Read-only: never mutates state; exits 0 in all non-error cases including the empty-repo case
- Uses `gh pr list --state open --json headRefName,createdAt`; no additional dependencies
- Client-side filter: only `headRefName` starting with `auto/`
- Pure functions `parseAgeBuckets` and `formatAgeLine` exported for test isolation — no `gh` call in tests
- `now: Date` injected as a parameter into `parseAgeBuckets` for deterministic testability
- Age boundaries: `< 1h` (`createdAt > now − 3600s`), `1–24h` (`now − 86400s ≤ createdAt ≤ now − 3600s`), `> 24h` (`createdAt < now − 86400s`)
- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`; no `any`; no `as` casts outside tests
- Test file uses `bun:test`; frozen `now` constant; three or more fixture payloads; no subprocess calls in tests; `main()` not imported in tests

## Acceptance criteria

- [ ] `scripts/auto-age-buckets.ts` exists and exports `AgeBuckets`, `parseAgeBuckets(rawJson: string, now: Date): AgeBuckets`, and `formatAgeLine(buckets: AgeBuckets): string`
- [ ] `parseAgeBuckets` filters to `headRefName.startsWith("auto/")` and correctly buckets by age using the injected `now`
- [ ] `formatAgeLine` returns `"N branches in flight: X < 1h, Y 1-24h, Z > 24h"` where N = X + Y + Z
- [ ] Zero state returns `"0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h"`
- [ ] `package.json` has `"auto:age": "bun scripts/auto-age-buckets.ts"` under scripts
- [ ] `scripts/auto-age-buckets.test.ts` covers empty, all-in-one-bucket, and mixed-bucket fixtures with exact string equality assertions
- [ ] `bun run auto:age` exits 0

## Context

- `scripts/auto-status.ts` (spec 052) is the direct sibling: state-based tally via `gh pr list --state all`.
- `scripts/intent-status.ts` (spec 051) is the verbose per-branch table via `git for-each-ref`.
- The age-buckets script provides the "staleness" signal: whether any open `auto/*` PRs are stuck.
- Related GitHub issue: #105.
