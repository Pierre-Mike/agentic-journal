---
id: 120-use-issue-number-as-spec-id-to-eliminate-allocation-race
title: Use issue number as spec id to eliminate allocation race
status: archived
kind: code
gate:
  - path: tests/workflows/intent.test.ts
    level: unit
  - path: tests/workflows/issue-number-spec-id.test.ts
    level: integration
created: 2026-04-30T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-30'
---

## Intent

Replace the sequential spec-id allocation scheme in `intent.yml` with the GitHub issue number so that concurrent pipeline runs can never collide on the same spec directory. Today the auto-aligner reads `specs/active/` and `specs/archive/` on `main` to derive the next id; when two issues open in the same minute both subagents see the same state, producing duplicate ids (observed: id 054 in PRs #112/#113). Using the issue number as the spec id sidesteps the race entirely — GitHub guarantees each issue a unique monotonically increasing number, so no locking, scanning, or collision is possible.

## Constraints

- `ISSUE_NUMBER` env var is already declared on the align step in `intent.yml` — no new CI secrets or env wiring required.
- Slug derivation rule (lowercase, hyphens, 50-char cap) must remain identical to branch-name derivation already in `intent.yml`.
- The `git add specs/active/*/alignment.md` glob in the "Commit alignment.md" step must continue to work unchanged.
- Existing archived specs (zero-padded ids like `054-…`) are **not** migrated — the new shape applies only to specs created after this lands.
- `bun scripts/worktree/worktree-open.ts` already accepts the full slug; no change to that script.

## Acceptance criteria

- [ ] `intent.yml` aligner prompt does not contain the words "allocate" or "next-id".
- [ ] `intent.yml` aligner prompt references `ISSUE_NUMBER` and encodes the `specs/active/${ISSUE_NUMBER}-<slug>/` path shape.
- [ ] The `git add specs/active/*/alignment.md` glob in "Commit alignment.md" is preserved.
- [ ] `auto-aligner.md` instructs the aligner to derive the spec dir as `specs/active/${ISSUE_NUMBER}-<slug>/` using the env var, not by scanning `specs/`.
- [ ] `auto-aligner.md` does not instruct scanning `specs/` for id allocation.
- [ ] `spec-tester.md` contains no prose about "allocate" or "next spec id" (verified no change needed).

## Context

Collision observed: PRs #112 and #113 both allocated spec id 054. Root cause: two pipeline runs read `specs/active/` before either pushed, both derived id 054 as `max + 1`. Fix: use `ISSUE_NUMBER` (already injected by GitHub Actions) as the canonical id. Branch naming already uses this convention (`auto/${{ github.event.issue.number }}-${SLUG}`) — this change brings spec directory naming into alignment with it. See alignment.md §Non-obvious Decisions for rejected alternatives (branch-name parsing, max+1 scanning).
