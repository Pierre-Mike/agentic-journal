---
id: 014-ci-feedback-loop
title: CI failure feedback loop — fetch logs and stage a fix
status: active
kind: workflow
gate: scripts/smoke-ci-feedback.ts
created: 2026-04-18
owner: main
depends_on: []
supersedes: null
---

## Intent

Today `/do` Step 9 watches CI and, when it goes red, prints "paused" and stops — the PR sits open until a human opens the logs, figures out which job failed, and decides what to do. This spec ships the deterministic missing half: `scripts/ci-feedback.ts` takes a PR URL, calls `gh` to fetch the failing job logs, and writes a `ci-failure.md` brief into the spec's active directory inside the worktree. The `/do` skill is updated so Step 9 invokes the script on red and Step 10 surfaces the path to the brief. A follow-up session (human or, later, an autonomous fix subagent) picks up `ci-failure.md` and drives the fix. No LLM call happens inside this script — the pipeline is pure `gh` + string formatting.

## Constraints

- TypeScript strict: no `any`, no `as` outside tests; named parameters for 3+ args
- Pure functions (covered by colocated `bun:test`):
  - `parseFailingChecks({ checksJson })` — given `gh pr checks --json` output, returns `{ name, conclusion, detailsUrl, runId }[]` for non-success results
  - `formatFailureBrief({ pr, failingChecks, logs })` — produces markdown brief content
  - `extractRunId({ detailsUrl })` — parses GitHub run id from `detailsUrl`
- IO helpers (covered by the smoke script via fixture-mocked `gh`):
  - `fetchPrChecks({ prUrl })` → parsed `gh pr checks <prUrl> --json name,state,link` output
  - `fetchFailingLogs({ runId })` → text from `gh run view <runId> --log-failed`
  - `writeBrief({ specDir, content })` → writes `ci-failure.md` next to `proposal.md`
- CLI: `bun scripts/ci-feedback.ts <pr-url> [--worktree <path>] [--dry-run]`
  - `--worktree <path>` default `process.cwd()`; script resolves the active spec dir inside it
  - `--dry-run` prints the brief to stdout instead of writing the file
- Smoke script mocks `gh` via a temp `PATH` override (a `gh` shim that reads fixture files and prints them)
- NEVER invoke `claude -p` or any LLM from this script — deterministic data flow only
- Pattern reference: `scripts/trace-scan.ts` (pure fns + IO + CLI + colocated test + smoke)

## Non-goals

- Autonomous LLM-driven fix loop (separate spec)
- Auto-pushing fixes back to the PR branch
- Modifying GitHub Actions workflow YAML
- Altering CI retry policy
- Editing any files inside the worktree outside the spec's active directory

## Acceptance criteria

- [ ] `scripts/ci-feedback.ts` exists with pure fns + CLI, exports `parseFailingChecks`, `formatFailureBrief`, `extractRunId`, `fetchPrChecks`, `fetchFailingLogs`, `writeBrief`, `run`
- [ ] `scripts/ci-feedback.test.ts` exists and passes under `bun test scripts/ci-feedback.test.ts`
- [ ] `scripts/smoke-ci-feedback.ts` exists and exits 0 under `bun scripts/smoke-ci-feedback.ts`
- [ ] `.claude/skills/do/SKILL.md` Step 9 invokes `bun scripts/ci-feedback.ts` on red CI; Step 10 paused report cites `ci-failure.md`
- [ ] `bun run check` passes
- [ ] `bun run spec:lint` passes
- [ ] `bun run tasks:verify` reports `✓ 014-ci-feedback-loop (workflow) — 1 workflow smoke(s) pass`

## Context

- `/do` skill: `.claude/skills/do/SKILL.md` (Steps 9 + 10)
- Pattern reference: `scripts/trace-scan.ts`, `scripts/smoke-trace-scan.ts`, `scripts/trace-scan.test.ts`
- Spec 005 set the pure-fn + IO-helper + smoke pattern that this spec reuses
