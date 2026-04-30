# Design

Thin wrapper around `gh pr list` with a pure formatting layer extracted for testability. Two exported pure functions (`parsePrList`, `formatLine`) cover all business logic; `main()` is a one-liner that shells out to `gh` and prints the result.

## Approach

1. `parsePrList(rawJson: string): Tally` — parse the `gh` JSON array, filter to `^auto/` branches, count draft/open/closed buckets (MERGED folds into closed).
2. `formatLine(tally: Tally): string` — format the tally into the exact output string.
3. `main()` — invoke `gh pr list --state all --json headRefName,state,isDraft` via `Bun.$`, pipe stdout to `parsePrList`, then `console.log(formatLine(...))`.

Tests call `parsePrList` + `formatLine` directly with fixture JSON strings — no subprocess or `gh` mock needed.

## Files touched

- `scripts/auto-status.ts` — new script (Tally interface + parsePrList + formatLine + main)
- `scripts/auto-status.test.ts` — unit tests for pure functions (slice 1 gate, scaffolded RED)
- `package.json` — add `"auto:status": "bun scripts/auto-status.ts"` to scripts
- `tests/auto-status-bdd.test.ts` — BDD integration gate for slice 2: file existence, package.json entry, exported API (scaffolded RED)

## Decisions

- **MERGED folds into closed** — the output format specifies exactly 3 buckets (draft / open / closed); exposing a 4th "merged" column contradicts the alignment's exact format string.
- **Export parsePrList + formatLine** — enables pure-function unit tests without any mocking framework; consistent with `intent-status.ts` (spec 051) which exports `formatAge`, `parseBranch`, `formatTable`.
- **Bun.$ for gh invocation** — consistent with `intent-status.ts`; no additional dependencies.
- **`bun scripts/auto-status.ts` (no `run`)** — matches `intent-status` style in `package.json`; `bun run` would be redundant.

## Out of scope

- Verbose per-branch table (that is `intent:status`)
- Pagination of `gh pr list` results (GitHub API default of 30 is sufficient for active auto/ PRs)
- Real `gh` invocation in tests
