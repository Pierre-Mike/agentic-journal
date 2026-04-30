---
id: 054-upload-ci-claude-traces-as-artifacts
title: Upload CI Claude traces as GitHub Actions artifacts
status: archived
kind: workflow
gate: scripts/smoke-ci-traces-upload.ts
created: 2026-04-30T00:00:00.000Z
owner: main
depends_on:
  - 005-trace-scan
supersedes: null
archived: '2026-04-30'
---

## Intent

CI runs that invoke Claude (slice.yml, intent.yml, claude.yml) produce structured observability traces in `.claude/traces/<session_id>.jsonl` via hooks.ts. These files are gitignored and currently discarded when the ephemeral runner terminates. This spec preserves those traces by uploading them as GitHub Actions artifacts (7-day retention) after each CI run, then teaches the `/retro` skill to download and incorporate CI traces so retrospectives can draw on real CI session data alongside local interactive traces — closing the observability gap between what Claude does in CI and what `/retro` can see.

## Constraints

- Use `actions/upload-artifact@v4`; artifact name `claude-traces-${{ github.run_id }}`; path `.claude/traces/`; retention 7 days
- Upload step must use `if: always()` to capture traces from failing runs
- No composite action — upload step added directly to each affected workflow (two-line change; composite adds scaffolding cost without meaningful DRY benefit at this scale)
- `/retro` CI artifact fetch is best-effort: `gh` failures must not break the skill for interactive local use
- Fetch CI artifacts into `.claude/traces-ci/` (not `.claude/traces/`) to preserve provenance and avoid live-trace clobbering
- No changes to `scripts/trace-scan.ts` — it already accepts `--traces-dir`

## Acceptance criteria

- [ ] slice.yml, intent.yml, and claude.yml each contain an `upload-artifact` step targeting `.claude/traces/` with `if: always()`
- [ ] `.claude/skills/retro/SKILL.md` Step 2 includes a "CI artifact traces" sub-section describing the `gh run download` flow
- [ ] `scripts/smoke-ci-traces-upload.ts` exits 0

## Context

Builds on spec 005 (trace-scan), which provided `scripts/trace-scan.ts` — the aggregator `/retro` uses to process JSONL trace files. This spec extends the data surface for that aggregator to include CI-generated traces.

Related: `.claude/hooks/observe.ts` (trace writer), `.github/workflows/slice.yml`, `.github/workflows/intent.yml`, `.github/workflows/claude.yml`.
