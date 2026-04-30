---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 68a43c6c46c4
---

## Goal

Add a read-only Bun script `scripts/intent-status.ts` (registered as `intent:status` in `package.json`) that queries `git for-each-ref` on `origin` to find every `auto/<n>-<slug>` branch, then prints a sorted, human-readable table showing the issue number, slug, and age since the branch's last commit. This gives developers and the auto-pilot loop a CLI-level view of in-flight work that mirrors what `bun run spec:status` provides for active spec directories — closing the observability gap introduced when `intent.yml` moved in-flight work to `auto/*` branches before scaffold lands.

## Big Picture

The existing `spec:status` script reads the local filesystem (`specs/active/`) to report on specs that have already been scaffolded. Before scaffold, the only artifact of an in-flight intent is its `auto/<n>-<slug>` branch on `origin`. `intent-status.ts` fills that gap by reading branch metadata from the remote ref store rather than the local filesystem.

```
origin (remote)
  refs/remotes/origin/auto/93-add-intent-status-...
  refs/remotes/origin/auto/87-another-in-flight-...
           |
           | git for-each-ref --format="%(refname) %(committerdate:iso-strict)"
           v
  scripts/intent-status.ts
           |
           | parse issue-number + slug + age
           | sort by age (oldest first)
           v
  stdout
  --------
  #  ISSUE  SLUG                              AGE
  -----------------------------------------------
  #  87     another-in-flight                 3d 14h
  #  93     add-intent-status-script          0d  2h
```

Companion test at `scripts/intent-status.test.ts` mocks the `git for-each-ref` subprocess so CI never needs network access.

## Straightforward Details

### Script location and registration

```
scripts/
  intent-status.ts        <- new script
  intent-status.test.ts   <- new colocated test (constitution §8)
package.json
  "intent:status": "bun scripts/intent-status.ts"
```

- Script lives directly under `scripts/` (not a subdirectory), consistent with flat single-file scripts like `scripts/issue-options.ts`.
- Registered as `intent:status` to match the `spec:status` naming pattern.

### Data source

```
git for-each-ref refs/remotes/origin/auto/
  --format=%(refname:short) %(committerdate:unix)
  --sort=committerdate
```

- Uses `refs/remotes/origin/auto/` so no fetch is needed; reads the local remote-tracking copy.
- `committerdate:unix` (epoch integer) is easiest to diff against `Date.now()` for age calculation.
- `--sort=committerdate` from git means the subprocess result is already sorted oldest-first; script confirms or re-sorts in TypeScript.

### Output format

```
in-flight intents:
  #93   add-intent-status-script-listing-in-flight-auto-br   0d  2h
  #87   another-in-flight-branch                             3d 14h

(empty state)
no in-flight intents.
```

- Header: `in-flight intents:` (mirrors `active specs:` from `spec-status.ts`).
- Each row: two-space indent, `#<n>` left-padded to align, slug, age formatted as `<N>d <H>h`.
- Empty state: single line `no in-flight intents.` then `process.exit(0)`.

### Age formatting

```
formatAge(seconds: number): string
  -> "<N>d <H>h"   (always show both components, zero-pad hours to 2 digits)
```

- Days = Math.floor(seconds / 86400)
- Hours = Math.floor((seconds % 86400) / 3600)
- No minutes (consistent granularity for a status listing).

### Branch name parsing

```
origin/auto/93-add-intent-status-script  ->  issue: 93, slug: add-intent-status-script
refs/remotes/origin/auto/93-...          ->  same after stripping prefix
```

- Regex: `/^(?:.*\/)?auto\/(\d+)-(.+)$/`
- `n` = first capture group (issue number, integer)
- `slug` = second capture group (everything after `<n>-`)

### Test strategy

- `intent-status.test.ts` stubs the child process call (Bun's `$` template or `Bun.spawn`) using `bun:test` mock APIs.
- Provides fixed `git for-each-ref` output with 0, 1, and 2+ branch cases.
- Asserts: header line present, rows sorted oldest-first, empty-state message, age formatting.

## Non-obvious Decisions

### Remote-tracking refs vs. live `git ls-remote`

- **Recommended:** read `refs/remotes/origin/auto/` via `git for-each-ref` (local copy of remote refs).
  - Rationale: no network call; works in CI without credentials; deterministic in tests; consistent with how `spec:status` reads local filesystem state. The `git fetch` that happens at the start of each CI run keeps remote-tracking refs fresh enough for a status listing.
- **Alternative rejected:** `git ls-remote origin 'refs/heads/auto/*'` — requires network; slower; harder to mock in tests; would break in airgapped or offline runs.

### Placement under `scripts/` vs. `scripts/intent/`

- **Recommended:** flat file `scripts/intent-status.ts` alongside `scripts/issue-options.ts` and similar single-file scripts.
  - Rationale: the script is a single file with one colocated test, matching the pattern of other standalone scripts. A subdirectory would be warranted only if multiple intent-related scripts existed.
- **Alternative rejected:** `scripts/intent/intent-status.ts` — premature grouping; adds import path complexity for no current benefit.

### Age display granularity

- **Recommended:** `<N>d <H>h` (days + hours only).
  - Rationale: status listings are glanced at, not used for exact scheduling. Minutes add noise. The `spec:status` script uses no timing at all; showing days+hours is already more informative.
- **Alternative rejected:** full `HH:MM:SS` or relative strings like "3 days ago" — harder to column-align; relative English strings complicate test assertions.
