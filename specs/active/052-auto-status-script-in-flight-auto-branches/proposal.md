---
id: 052-auto-status-script-in-flight-auto-branches
title: Add auto:status script summarizing in-flight auto branches
status: active
kind: code
# per-task gates declared in tasks.md; listed here for readability
gate:
  - path: scripts/auto-status.test.ts
    level: unit
  - path: tests/auto-status-bdd.test.ts
    level: integration
created: 2026-04-30
owner: main
depends_on: []
supersedes: null
---

## Intent

Add `scripts/auto-status.ts`, registered as `bun run auto:status` in `package.json`, that queries the GitHub API for all PRs whose head branch matches `^auto/` and prints a single compact line tallying how many are draft, open (non-draft), and closed/merged. Complements the verbose per-branch listing from `bun run intent:status` (spec 051) with a quick at-a-glance badge suitable for pre-filing sanity checks.

## Constraints

- Read-only: never mutates state; exits 0 in all non-error cases including the empty-repo case
- Uses `gh pr list --state all --json headRefName,state,isDraft`; no additional dependencies
- Pure parsing functions (`parsePrList`, `formatLine`) are exported for test isolation — no `gh` call in tests
- `MERGED` and `CLOSED` states both land in the "closed" bucket (3-bucket model only)
- `headRefName` must match `/^auto\//` to be included in the tally
- TypeScript strict mode; no `any`; typed interface for the `gh` JSON response
- Test file `scripts/auto-status.test.ts` uses `bun:test`; three fixture payloads minimum

## Acceptance criteria

- [ ] `scripts/auto-status.ts` exists and exports `parsePrList(json: string): Tally` and `formatLine(tally: Tally): string`
- [ ] `parsePrList` counts draft / open / closed correctly; filters non-`^auto/` branches; folds MERGED into closed
- [ ] `formatLine({ draft, open, closed })` returns `"N branches in flight: X draft, Y open, Z closed"` where N = draft + open + closed
- [ ] Zero state returns `"0 branches in flight: 0 draft, 0 open, 0 closed"`
- [ ] `package.json` has `"auto:status": "bun scripts/auto-status.ts"` under scripts
- [ ] `scripts/auto-status.test.ts` covers empty, mixed-state, and all-closed fixture payloads with exact string equality assertions on `formatLine(parsePrList(fixture))`
- [ ] `bun run auto:status` exits 0 (no crash when `gh` returns zero results)

## Context

- `scripts/intent-status.ts` (spec 051) is the sibling: verbose per-branch table via `git for-each-ref`. `auto-status.ts` provides the compact badge via GitHub API.
- Naming follows `intent:status` convention in `package.json`.
- Related GitHub issue: #101.
