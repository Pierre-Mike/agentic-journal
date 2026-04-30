# Design

Single-line regex fix to the fallback issue-number extractor in `automerge.yml`,
plus an optional comment update for clarity.

## Approach

Replace the broken `grep -oP '(?<=issue-)\d+'` on line 58 of
`.github/workflows/automerge.yml` with `grep -oP '^auto/\K[0-9]+'`.
Optionally update the comment on line 56 to reflect the real branch convention.

A bash smoke script (`scripts/smoke/automerge-issue-lookup.sh`) asserts both:
1. The correct regex is present (and the broken one is absent) in the workflow file.
2. The extraction logic returns expected values for representative branch names.

## Files touched

- `.github/workflows/automerge.yml` — line 58 regex; line 56 comment (optional)
- `scripts/smoke/automerge-issue-lookup.ts` — new gate artifact (RED → GREEN)

## Decisions

- **`^auto/\K[0-9]+` vs `(?<=^auto/)[0-9]+`** — Use `\K`; variable-length
  lookbehinds are rejected by older PCRE versions that ship on ubuntu-latest.
  `\K` is universally supported and idiomatic in `grep -oP` invocations.
- **Anchor `^auto/`** — Rejected `(?<=auto/)\d+` without anchoring; technically
  safe today (no branch has mid-path `auto/`), but anchoring costs nothing and
  is more correct.
- **No `gh api` third fallback** — Adds network dependency and rate-limit risk.
  The regex fix covers all branches created by `align.yml`. A separate spec can
  add the API fallback if edge cases surface.
- **Smoke in TypeScript** — The `tasks-verify` runner uses `bun <path>` for
  workflow gates; `.sh` files cannot be run this way. TypeScript is idiomatic
  for this repo's smoke scripts regardless.

## Out of scope

- Changes to `align.yml` (branch format is already correct)
- A `gh api` lookup as a third fallback
- Any changes to the downstream consumers of `ISSUE_NUMBER`
