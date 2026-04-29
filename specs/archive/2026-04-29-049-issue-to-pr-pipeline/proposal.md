---
id: 049
title: Issue→PR autonomous pipeline
status: archived
kind: code
gate:
  - path: tests/automation-pipeline.test.ts
    level: integration
  - path: scripts/spec-lint.test.ts
    level: unit
created: 2026-04-29T00:00:00.000Z
owner: main
depends_on:
  - 046-do-auto-headless
  - 047-morning-digest
supersedes: null
archived: '2026-04-29'
---

## Intent

Build a self-driving issue→PR pipeline so the user can file a GitHub issue from any device and have Claude (running in GitHub Actions, no local machine required) align, spec, slice, implement in parallel, deploy a preview, validate, and auto-merge — pausing only when intent is genuinely ambiguous or a slice exhausts its retry budget.

## Constraints

- No local machine required — all orchestration runs in GitHub Actions
- User interaction limited to: filing issue, replying to clarification comments, responding to failure menu
- Single feature branch per issue (not child PRs) — one PR, full diff visible
- BDD outer gate stays RED until final slice — early green signals spec gap
- `touches:` declarations enforce parallelism safety alongside `depends_on:` DAG
- Alignment frozen via CODEOWNERS after `confidence: high`
- Failure forensics preserved — PR stays draft on failure, no rollback

## Acceptance Criteria

- [ ] `bootstrap.yml` triggers on `issues.opened|edited` and `issue_comment.created`, creates branch `auto/<issue#>-<slug>`, opens draft PR, invokes `/do-auto`, commits `alignment.md` only on `confidence: high`
- [ ] `CODEOWNERS` contains a rule protecting `specs/active/*/alignment.md` (freeze after alignment)
- [ ] `dag-controller.ts` exports a `dispatchable(tasks, inFlight)` function that returns slice IDs where depends_on is satisfied AND touches∩in-flight=∅
- [ ] `specs/_template/tasks.md` schema declares `depends_on:` and `touches:` keys per slice
- [ ] `controller.yml` runs on `schedule: cron` (~2min), reads tasks.md DAG, dispatches ready slices via `repository_dispatch`
- [ ] `slice.yml` triggers on `repository_dispatch`, runs `claude -p` with expertise skill, executes `pull --rebase && push` with retry on conflict
- [ ] `preview.yml` deploys via `wrangler versions upload`, posts preview URL on PR, runs `playwright --base-url=$PREVIEW_URL`, runs BDD outer gate (expected RED until last slice)
- [ ] `issue-options.ts` exports `failureMenu(sliceId, title)` returning the 4-option (retry/split/skip/abort) markdown body
- [ ] `automerge.yml` triggers on PR check completion, requires DAG-done + outer-gate-✓ + preview-e2e-✓, squash-merges, closes linked issue

## Context

Builds on:
- `046-do-auto-headless`: `/do-auto` headless Claude entry point
- `047-morning-digest`: scheduled workflow infrastructure patterns

The DAG controller (`dag-controller.ts`) is the algorithmic core: it reads tasks.md, evaluates `depends_on` completions and `touches:∩in-flight=∅`, and emits the set of safe-to-dispatch slice IDs. This logic is locally unit-testable and is the main reason this is `kind: code` rather than `kind: workflow`.

The `touches:` field extends the existing tasks.md schema with file-level conflict detection. This catches shared-registry / lockfile / barrel-file collisions that pure DAG ordering misses.
