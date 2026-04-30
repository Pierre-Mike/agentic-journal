---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 6e87497d279d
---

## Goal

Add `scripts/auto-status.ts` — a read-only CLI script invoked as `bun run auto:status` — that queries the GitHub API for all PRs whose head branch matches `^auto/` and prints a single-line tally of how many are draft, open (non-draft), and closed. The output is a compact status badge suitable for a quick CLI sanity check before filing a new issue and complements the verbose per-branch listing already provided by `bun run intent:status` (issue #93). The script must exit 0 in all non-error cases, including the empty-repo case.

## Big Picture

The feature is a thin wrapper around `gh pr list` with a pure formatting layer extracted for testability. The test file mocks the JSON response and asserts the exact formatted line without shelling out to `gh`.

```
  package.json
       |
       | "auto:status": "bun scripts/auto-status.ts"
       v
  scripts/auto-status.ts
       |
       |-- parsePrList(json: string): Tally    (pure, testable)
       |-- formatLine(tally: Tally): string    (pure, testable)
       |-- main(): void                        (shells out to gh)
       v
  scripts/auto-status.test.ts
       |
       |-- mocks gh JSON, calls parsePrList + formatLine
       |-- asserts exact output string
```

Data flow:

```
gh pr list --state all --json headRefName,state,isDraft
       |
       v  (JSON array)
  filter: headRefName matches ^auto/
       |
       v
  count draft / open / closed
       |
       v
  "N branches in flight: X draft, Y open, Z closed"
```

## Straightforward Details

### gh CLI invocation

```
gh pr list --state all --json headRefName,state,isDraft
```

- `state: "OPEN"` with `isDraft: true`  → draft bucket
- `state: "OPEN"` with `isDraft: false` → open bucket
- `state: "CLOSED"` or `state: "MERGED"` → closed bucket
- `headRefName` must match `/^auto\//` to be included

### Output format (exact)

```
N branches in flight: X draft, Y open, Z closed
```

- N = draft + open + closed (total matching branches)
- Zero state: `0 branches in flight: 0 draft, 0 open, 0 closed`
- No trailing newline ambiguity: use `console.log` (adds `\n`)

### File targets

- `scripts/auto-status.ts` — new script
- `scripts/auto-status.test.ts` — new test (colocated, per constitution §8)
- `package.json` — add `"auto:status": "bun scripts/auto-status.ts"` to scripts

### TypeScript constraints (constitution §5)

- `strict: true` — no `any`, no unguarded index access
- Parse the JSON response with a typed interface, not `JSON.parse` to `any`
- Use `Bun.$` shell tag or `Bun.spawnSync` for the `gh` invocation (consistent with `intent-status.ts`)

### Test strategy

- `scripts/auto-status.test.ts` uses Bun's built-in test runner (`import { test, expect } from "bun:test"`)
- Provide at least three fixture payloads: empty array, mixed state, all-closed
- Assert exact string equality on `formatLine(parsePrList(fixture))`
- No real `gh` calls in tests — mock data only

### Spec kind

- `kind: code` (new TypeScript file + test)
- Outer gate: `scripts/auto-status.test.ts` (the acceptance test is the gate)

## Non-obvious Decisions

### Tally computation: treat MERGED as "closed"

The `gh pr list --state all` response uses `state: "MERGED"` for merged PRs, distinct from `state: "CLOSED"`. The intent says "closed" without elaborating. The intent's acceptance criteria show only 3 buckets (draft / open / closed), so MERGED and CLOSED both land in the closed bucket.

- Recommended: fold `state === "MERGED"` into the closed counter. This matches the intent's 3-bucket model and avoids a surprise 4th column.
- Alternative rejected: expose a 4th "merged" bucket — not specified, contradicts the exact output format in the intent.

### Pure parsing function vs. inline logic

Splitting the `gh` call from the tally computation (`parsePrList`) makes the test file straightforward without any mocking framework: tests just call the pure function with fixture strings.

- Recommended: export `parsePrList(rawJson: string): Tally` and `formatLine(tally: Tally): string`; keep `main()` as a thin shell.
- Alternative rejected: test via subprocess / process.stdout capture — heavyweight, slower, harder to maintain.

### npm script name

The intent specifies `auto:status` (matching the `intent:status` naming convention already in the repo).

- Recommended: `"auto:status": "bun scripts/auto-status.ts"` — direct execution, no build step needed.
- Alternative rejected: `"auto:status": "bun run scripts/auto-status.ts"` — redundant `run`, not the style used by `intent-status` in `package.json`.
