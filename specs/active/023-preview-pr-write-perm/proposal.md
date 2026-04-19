---
id: 023-preview-pr-write-perm
title: Preview workflow pull-requests:write permission
status: active
kind: workflow
gate: scripts/smoke-preview-workflow.ts
created: 2026-04-19
owner: main
depends_on:
  - 019-preview-env-fix
supersedes: null
---

## Intent

PR preview comments currently 403 on every PR because `.github/workflows/preview.yml`
has no `permissions:` block and the default `GITHUB_TOKEN` lacks `pull-requests: write`.
Grant the minimum required scope and lock it in via the existing smoke gate so reviewers
get the preview link and PR status stops being misleadingly red.

## Constraints

- Workflow-scope `permissions:` block (not job-scope).
- Extend existing gate `scripts/smoke-preview-workflow.ts`; do not replace.
- No new dependencies.
- No changes to `deploy.yml`.
- Gate must remain zero-dep regex/string style (consistent with existing checks).

## Acceptance criteria

- [ ] `.github/workflows/preview.yml` contains `permissions:` block at workflow scope with `contents: read` and `pull-requests: write`
- [ ] `scripts/smoke-preview-workflow.ts` asserts the permissions block contains `pull-requests: write`
- [ ] `scripts/smoke-preview-workflow.test.ts` covers (a) missing-block → exit 1 (b) present-block → exit 0
- [ ] `bun run tasks:verify` green

## Context

Retro-driven fix. 5/5 PRs in window (PRs 34, 36, 38, 39, 41, 42, 43) failed on
"Comment preview URL" step. Log confirms 403 on
`POST /repos/:owner/:repo/issues/:num/comments`. Predecessor spec
019-preview-env-fix addressed env-var defense in the same workflow.
