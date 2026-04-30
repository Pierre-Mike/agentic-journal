---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 48b4d41b0eab
---

## Goal

Replace the current sequential spec-id allocation scheme in `intent.yml` with the GitHub issue number so that two concurrent pipeline runs can never collide on the same spec directory. Today the auto-aligner reads `specs/active/` and `specs/archive/` on `main` to derive the next id; when two issues open in the same minute both subagents read `main` before either pushes, producing duplicate ids (as happened with id 054 in PRs #112/#113). Using the issue number as the spec id sidesteps the race entirely because GitHub guarantees each issue a globally unique, monotonically increasing number — no locking, no scanning, no collision possible.

## Big Picture

```
GitHub issue opened / commented
        │
        ▼
intent.yml  ─── align job
        │         ├── Assemble intent → .agentic/last-intent.txt
        │         ├── Run auto-aligner subagent
        │         │     reads: ISSUE_NUMBER env var  (NEW)
        │         │     writes: .agentic/last-alignment.md
        │         │             specs/active/120-<slug>/alignment.md  (NEW path shape)
        │         └── Commit alignment.md → auto/<issue>-<slug> branch
        │
        └── scaffold job
              reads: specs/active/120-<slug>/alignment.md
              writes: proposal.md, design.md, tasks.md, outer gate
```

The branch name already uses the issue number (`auto/${{ github.event.issue.number }}-${SLUG}`) — this change brings the spec directory into the same convention, eliminating the separate id-allocation step entirely.

## Straightforward Details

### intent.yml — align job, "Run auto-aligner subagent" step

```
Current prompt fragment:
  "allocate a new spec id, kebab-slug from the issue title"

Replacement:
  "Use issue number $ISSUE_NUMBER as the spec id.
   Write alignment to specs/active/${ISSUE_NUMBER}-<slug>/alignment.md."
```

- Remove any language referring to "next-id" or "allocate" from the aligner prompt in intent.yml (line 177).
- The `ISSUE_NUMBER` env var is already declared on the step (`ISSUE_NUMBER: ${{ github.event.issue.number }}`), so no new env wiring is required.
- The aligner writes two files as before: `.agentic/last-alignment.md` (mailbox) and `specs/active/${ISSUE_NUMBER}-<slug>/alignment.md` (spec folder copy).

### auto-aligner agent (this session and .claude/agents/auto-aligner.md if it exists)

- Aligner must be instructed to derive the spec dir as `specs/active/${ISSUE_NUMBER}-<slug>/` using the env var, not by scanning `specs/`.
- Slug is derived from the issue title (lowercase, hyphens, 50-char cap) — same logic as the branch name derivation already in intent.yml.

### .claude/agents/spec-tester.md

- Line 29: `bun scripts/worktree/worktree-open.ts <slug>` — no change needed (worktree-open already accepts the full slug, not just the numeric id).
- Any prose mentioning "allocate" or "next spec id" must be updated to "use the spec id passed in by the orchestrator / present in the spec folder path".
- No structural changes to scaffold mode or slice mode — the spec-tester reads the spec dir path from the orchestrator; how that path was derived is opaque to it.

### tests/workflows/intent.test.ts (to be created if not existing)

- Assert that the aligner prompt in intent.yml does NOT contain "next-id" or "allocate".
- Assert that the aligner prompt references `ISSUE_NUMBER` (or the env var name chosen).
- Assert that the `git add` step in "Commit alignment.md" still covers `specs/active/*/alignment.md` (it already does via glob).

### Existing specs — no migration

- The 53+ archived specs keep their zero-padded three-digit ids (e.g. `054-…`). The new shape only applies to specs created after this lands.
- Zero-padding: issue numbers are used as-is (e.g. `120`, `1001`). Lexical sort breaks past #999 but lex-sort is not load-bearing — spec-status.ts works from filesystem state, not id order.

## Non-obvious Decisions

### Decision: use env var injection vs. parsing branch name

- Recommended: inject `ISSUE_NUMBER` as an env var on the aligner step (already present) and instruct the aligner to read it from the environment. This is already wired — the step's `env:` block sets `ISSUE_NUMBER: ${{ github.event.issue.number }}`. The aligner reads it via Bash or directly references it in the prompt template.
- Rejected alternative — parse the branch name inside the aligner: the branch name is available in the repo via `git rev-parse --abbrev-ref HEAD`, but requires an extra Bash call and is fragile if the branch naming convention ever changes. The env var is the canonical source.
- Rejected alternative — scan `specs/active/` and pick the highest numeric prefix: this is exactly the allocation race being eliminated. Even with a "max + 1" strategy, two concurrent runs would still collide.

### Decision: slug derivation — reuse branch slug logic vs. re-derive inside aligner

- Recommended: the aligner derives the slug independently from the issue title using the same rules as intent.yml's "Derive branch name from issue" step (lowercase, replace non-alphanumeric with `-`, collapse runs, strip leading/trailing hyphens, truncate at 50 chars). The resulting spec dir is `specs/active/${ISSUE_NUMBER}-${SLUG}/`. This keeps the aligner self-contained.
- Rejected alternative — pass the branch name as a second env var and strip the `auto/NNN-` prefix: introduces a second injection point and couples the aligner to the branch naming convention. More brittle for no gain.

### Decision: backward compatibility of the "Commit alignment.md" git-add glob

- The existing `git add specs/active/*/alignment.md` glob in intent.yml already matches any depth-1 subdirectory of `specs/active/`, so it will pick up `specs/active/120-…/alignment.md` without modification. No change needed to the commit step.
- Confirmed: the scaffold job's `find specs/active -name alignment.md -type f | head -1` also works unchanged — it finds alignment.md regardless of the directory naming scheme.
