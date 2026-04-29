---
created: 2026-04-29
status: confirmed
confidence: high
intent_hash: 7e2f1a4c8d3b
---

## Goal

Build a self-driving issue→PR pipeline so the user can file a GitHub issue from any device and have Claude (running in GitHub Actions, no local machine required) align, spec, slice, implement in parallel, deploy a preview, validate, and auto-merge — pausing only when intent is genuinely ambiguous or a slice exhausts its retry budget. The user stays unblocked: clarifications happen as comments on the issue itself; failures surface as a four-option menu (retry / split / skip / abort) the user resolves by replying.

## Big Picture

```
GitHub issue (open|edit|comment)
        │
        ▼
bootstrap.yml ─── branch auto/<issue#>-<slug>, draft PR
        │
        ▼
claude -p "/do-auto <issue body>"
        │
   ┌────┴────┐
   │ low?    │ → bot comment requests clarification → loop on issue edit
   │ high?   │ → commit alignment.md → CODEOWNERS freezes it
        │
        ▼
spec-tester writes proposal.md + BDD outer gate (kind:code)
        + tasks.md with depends_on: [...] + touches: [paths]
        ▼
controller.yml (cron 2min)
   reads tasks.md DAG
   for each pending slice where:
     depends_on satisfied AND touches ∩ in-flight = ∅
   dispatches slice.yml via repository_dispatch (parallel, no cap)
        ▼
slice.yml (matrix, fresh claude -p per slice + expertise skill)
   pull --rebase → work → push (retry on non-fast-forward)
   replanner runs → patches tasks.md if downstream invalidated
        ▼
preview.yml on every push
   wrangler versions upload → preview URL on PR
   playwright --base-url=$PREVIEW_URL
   BDD outer gate runs (EXPECTED RED until last slice)
   if outer gate green early → bot comments "spec gap detected"
        ▼
automerge.yml — DAG done ∧ outer gate ✓ ∧ preview e2e ✓
   squash-merge to main, close issue, archive spec
```

## Straightforward Details

### Triggers
- `issues.opened`, `issues.edited`, `issue_comment.created` — no label needed; every new issue starts the pipeline
- User clarifications happen as issue edits or comments → workflow re-runs

### Spec scope
- `kind: code` — DAG controller has testable logic; BDD outer gate enforces end-to-end behavior
- `gate: tests/automation-pipeline.test.ts` (single outer gate; per-slice gates colocated with slice file_targets)
- `depends_on: [046-do-auto-headless, 047-morning-digest]`

### Files (8 deliverables)
- `.github/workflows/bootstrap.yml` — issue→branch→aligner→spec scaffold
- `.github/workflows/controller.yml` — cron 2min, reads tasks.md DAG, dispatches ready slices
- `.github/workflows/slice.yml` — matrix-job, fresh claude -p per slice, expertise loaded
- `.github/workflows/preview.yml` — wrangler preview + playwright e2e + BDD outer gate
- `.github/workflows/automerge.yml` — gate aggregator, squash-merge, close issue
- `.github/CODEOWNERS` — freeze `specs/active/*/alignment.md` after high-confidence
- `specs/_template/tasks.md` — extend schema with `depends_on:`, `touches:`
- `scripts/dag-controller.ts` — DAG eval logic (locally testable)
- `scripts/issue-options.ts` — emits failure menu comment

### Failure handling
- Slice fails 3 retries → bot comments on issue with menu: retry / split / skip / abort
- User replies with choice → `issue_comment.created` retriggers controller from chosen action
- Push race on feature branch → `pull --rebase && push` retry; `touches:` ∩ invariant guarantees clean rebase
- Rebase fails twice → `@claude rebase` comment → human pinged after second rebase failure

## Non-obvious Decisions

### Decision: single feature branch with commits per slice (not child PRs)

Recommended — slice = commit on the feature branch, not a child PR into a parent PR. User explicitly chose this for review simplicity (one PR, full diff visible). Push race handled by `pull --rebase` + retry; `touches:` invariant guarantees the rebase is always clean.

Rejected: child-PR-per-slice. Cleaner isolation but multiplies PR review surface and obscures the end-state diff. User decision: speed and reviewability win.

### Decision: BDD outer gate stays RED until last slice (early-green = spec gap)

Recommended — outer gate runs on every slice commit and is **expected to fail** until the final slice lands. If it passes early, the spec is wrong (a slice is missing or overspecified). Bot comments `spec gap detected` on the issue and pauses.

Rejected: run outer gate only at the end. Misses the early-green-bug detector entirely.

### Decision: `touches:` declaration enforces parallelism safety, not depends_on alone

Recommended — DAG `depends_on:` models *logical* deps; `touches: [paths]` models *file* deps. Controller dispatches a slice only if its `touches:` ∩ in-flight slices' `touches:` = ∅. Catches the realistic conflict cases the DAG misses: shared registries, lockfile, tasks.md itself, barrel files.

Rejected: rely on DAG only + auto-rebase on conflict. Works for trivial cases; breaks on shared util discoveries mid-flight.

### Decision: failure menu posted on the issue, PR stays draft

Recommended — when a slice exhausts 3 retries, bot posts a 4-option menu (retry / split / skip / abort) as an issue comment. User replies with choice; `issue_comment.created` retriggers the workflow from the chosen action. PR stays draft so auto-merge cannot fire.

Rejected: rolling back the failed slice's commit. Destroys forensic evidence; user loses ability to inspect the partial work.

### Decision: alignment.md freeze via CODEOWNERS, not branch protection

Recommended — `specs/active/*/alignment.md @no-such-user` in CODEOWNERS makes the file effectively read-only on the branch (no one can approve their own edits). Cheap, in-tree, no admin config needed.

Rejected: branch protection rule for that path. Requires repo admin access and is invisible to reviewers.

### Decision: kind:code (not kind:workflow) despite workflows being deliverables

Recommended — `kind: code`. The DAG controller has real logic (DAG eval, touches-intersection check, status reconciliation) that demands TDD. The workflow YAMLs are config but the controller they call into is code.

Rejected: `kind: workflow`. Would skip the spec-judge cycle and lose the test-implementation isolation guarantee on the controller logic.
