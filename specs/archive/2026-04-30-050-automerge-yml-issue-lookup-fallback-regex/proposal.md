---
id: 050-automerge-yml-issue-lookup-fallback-regex
title: Fix automerge fallback regex to match auto/<N>-<slug> branches
status: active
kind: workflow
gate: scripts/smoke/automerge-issue-lookup.ts
created: 2026-04-30
owner: main
depends_on: []
supersedes: null
---

## Intent

The fallback branch-name parser in `automerge.yml` (line 58) uses `(?<=issue-)\d+`
which never matches the actual `auto/<N>-<slug>` branch convention set in `align.yml`.
As a result, whenever a PR body lacks a `Closes #N` line the issue number is silently
lost: linked issues are never closed after merge and failure fan-in comments never
reach the issue. A one-line regex change to `^auto/\K[0-9]+` fixes all three
downstream consumers.

## Constraints

- Only `.github/workflows/automerge.yml` line 58 changes; no other files are required
- Regex must use PCRE `\K` form (not variable-length lookbehind) for compatibility
  with all grep `-P` versions on ubuntu-latest runners
- No `gh api` third-fallback added — out of scope; separate spec if needed
- Smoke script is zero-new-deps (pure bash + grep, no network, no spawn)

## Acceptance criteria

- [ ] `automerge.yml` line 58 uses `grep -oP '^auto/\K[0-9]+'` (broken `(?<=issue-)` removed)
- [ ] Branch `auto/90-some-slug` extracts issue number `90`
- [ ] Branch `auto/1-short-slug` extracts `1`
- [ ] Branch `auto/123-multi-word-slug-here` extracts `123`
- [ ] Branch `issue-90-old-format` extracts nothing (old format rejected)
- [ ] Branch `feature/no-number` extracts nothing (non-auto branch rejected)
- [ ] `scripts/smoke/automerge-issue-lookup.sh` exits 0 against the patched workflow

## Context

`align.yml:41` sets the branch as `auto/${{ github.event.issue.number }}-${{ steps.slug.outputs.value }}`.
The number appears immediately after `auto/`, not after `issue-`. The three downstream
consumers of `ISSUE_NUMBER` (spec-gap comment, close-issue, failure fan-in) all
silently no-op when the variable is empty — the bug is invisible until an issue
stays open after a clean merge.
