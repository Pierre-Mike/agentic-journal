---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: f3f38854b212
---

## Goal

Add `scripts/auto-age-buckets.ts` — a read-only CLI that queries open `auto/*` pull requests via `gh pr list`, buckets them by age (< 1h, 1–24h, > 24h), and prints a single summary line. A matching `auto:age` entry is added to `package.json`. The script complements the existing `auto:status` (state breakdown) and `intent:status` (full list) commands by surfacing at a glance whether any branches are stuck (> 24h without merging), closing a gap in the pipeline's observability surface.

## Big Picture

The new script slots in beside `scripts/auto-status.ts` as a second read-only `auto/*` lens.

```
gh pr list --state open --json headRefName,createdAt
        │
        ▼
  parseAgeBuckets(rawJson, now)        ← pure, testable
        │
        ▼
  AgeBuckets { ltOneHour, oneToTwentyFour, gtTwentyFour }
        │
        ▼
  formatAgeLine(buckets)               ← pure, testable
        │
        ▼
  stdout: "N branches in flight: X < 1h, Y 1-24h, Z > 24h"

package.json
  "auto:age": "bun scripts/auto-age-buckets.ts"

scripts/
  auto-age-buckets.ts        ← implementation
  auto-age-buckets.test.ts   ← unit test (frozen "now", mocked gh JSON)
```

The pattern mirrors `auto-status.ts` exactly: a pure `parse*` function, a pure `format*` function, a `main()` that shells out to `gh`, and a colocated test file. The outer gate is `scripts/auto-age-buckets.test.ts`.

## Straightforward Details

### File layout

```
scripts/
  auto-age-buckets.ts        ← new: implementation
  auto-age-buckets.test.ts   ← new: outer gate + unit tests
package.json                 ← add "auto:age" script entry
```

### Output format (exact)
- Non-empty: `N branches in flight: X < 1h, Y 1-24h, Z > 24h`
- Empty state: `0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h`
- N = X + Y + Z (total of open `auto/*` PRs)

### gh invocation
- Command: `gh pr list --state open --json headRefName,createdAt`
- Filter client-side: only entries where `headRefName` starts with `auto/`
- Field used for age: `createdAt` (ISO 8601 string)

### Age bucket boundaries (hardcoded)
```
< 1h          createdAt > now - 3600s
1-24h         createdAt in [now - 86400s, now - 3600s]
> 24h         createdAt < now - 86400s
```

### Exported API surface (pure functions, mirroring auto-status.ts)
```
export interface AgeBuckets {
  ltOneHour: number;
  oneToTwentyFour: number;
  gtTwentyFour: number;
}
export function parseAgeBuckets(rawJson: string, now: Date): AgeBuckets
export function formatAgeLine(buckets: AgeBuckets): string
```

### Test strategy
- All tests use a frozen `now` date constant
- Three or more fixtures: empty array, all-in-one-bucket, mixed buckets
- Assert exact formatted string output
- No subprocess calls in tests; `main()` is not imported in tests

### TypeScript axioms to respect
- `strict: true`, `noUncheckedIndexedAccess: true`, no `any`, no `as` casts outside tests
- `now` passed as a parameter to `parseAgeBuckets` to keep it deterministically testable

### package.json entry
- Key: `"auto:age"`
- Value: `"bun scripts/auto-age-buckets.ts"`

## Non-obvious Decisions

### `now` as a parameter vs. `Date.now()` inline

- **Recommended:** Accept `now: Date` as a second argument to `parseAgeBuckets`. This makes the function deterministically testable without any mocking infrastructure — tests simply pass a fixed `Date` object. The `main()` function calls `parseAgeBuckets(raw, new Date())`.
- **Alternative — `Date.now()` inline:** Simpler call site but forces tests to use fake timers or time-travel libraries. Rejected because the repo's test axiom prefers colocated pure-function tests with no subprocess or global-state mocking overhead. `auto-status.ts` avoids this problem entirely because its bucketing is state-based (no time); for age-based bucketing, injecting `now` is the minimal change.

### `--state open` vs. `--state all`

- **Recommended:** Use `--state open` (matching the intent spec verbatim). Only open branches are "in flight"; closed/merged branches are irrelevant to an age-staleness check.
- **Alternative — `--state all`:** Would include merged PRs, inflating bucket counts and defeating the purpose of the "stuck" signal. Rejected.

### Single-file vs. shared utility for `auto/*` filtering

- **Recommended:** Duplicate the `headRefName.startsWith("auto/")` filter inline in `auto-age-buckets.ts`, exactly as `auto-status.ts` does it. Both scripts are small and adding a shared utility for a one-liner would over-engineer the solution.
- **Alternative — extract to `scripts/lib/auto-filter.ts`:** Premature abstraction for two call sites with identical one-liner logic. Rejected unless a third consumer appears.
