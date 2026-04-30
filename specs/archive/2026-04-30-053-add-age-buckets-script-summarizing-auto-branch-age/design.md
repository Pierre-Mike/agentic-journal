# Design

Mirrors `auto-status.ts` exactly: two exported pure functions plus a thin `main()` that shells out to `gh`. All business logic lives in `parseAgeBuckets` and `formatAgeLine`; `main()` is a one-liner. `now: Date` is injected for deterministic testability.

## Approach

1. `parseAgeBuckets(rawJson: string, now: Date): AgeBuckets` — parse the `gh` JSON array, filter to `auto/*` branches, classify each `createdAt` against `now` into one of three buckets.
2. `formatAgeLine(buckets: AgeBuckets): string` — format the three-bucket count into the exact output string.
3. `main()` — invoke `gh pr list --state open --json headRefName,createdAt` via `Bun.$`, pass stdout to `parseAgeBuckets(raw, new Date())`, then `console.log(formatAgeLine(...))`.

Tests call `parseAgeBuckets` + `formatAgeLine` directly with fixture JSON strings and a frozen `now` constant — no subprocess or `gh` mock needed.

## Files touched

- `scripts/auto-age-buckets.ts` — new: `AgeBuckets` interface + `parseAgeBuckets` + `formatAgeLine` + `main`
- `scripts/auto-age-buckets.test.ts` — new: unit tests for pure functions (outer gate + slice 1 gate, scaffolded RED)
- `package.json` — add `"auto:age": "bun scripts/auto-age-buckets.ts"` to scripts
- `tests/auto-age-buckets-bdd.test.ts` — new: BDD integration gate for slice 2 — verifies file exists, package.json entry present, exported API shape correct (scaffolded RED)

## Decisions

- **`now` as a parameter** — injected into `parseAgeBuckets` to keep it deterministically testable without fake timers or global state mocking. `main()` passes `new Date()`. Rejected `Date.now()` inline because it forces time-travel libraries in tests.
- **`--state open` only** — only open branches are "in flight"; `--state all` would inflate counts with merged/closed PRs and defeat the staleness signal.
- **Inline `auto/` filter** — duplicates `headRefName.startsWith("auto/")` inline, same as `auto-status.ts`. No shared utility for a one-liner at two call sites.
- **Export `parseAgeBuckets` + `formatAgeLine`** — enables pure-function unit tests without any mocking framework; consistent with `auto-status.ts`.

## Out of scope

- Verbose per-branch table (that is `intent:status`)
- Pagination of `gh pr list` results
- Real `gh` invocation in tests
- Shared `auto/` filter utility
