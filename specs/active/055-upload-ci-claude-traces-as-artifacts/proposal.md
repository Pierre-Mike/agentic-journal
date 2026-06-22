---
id: 055-upload-ci-claude-traces-as-artifacts
title: Upload CI Claude traces as artifacts (naming, retention, fetch script)
status: active
kind: code
gate:
  - path: scripts/agentic/traces-fetch.test.ts
    level: unit
  - path: tests/055-traces-artifacts-bdd.test.ts
    level: integration
created: 2026-04-30
owner: main
depends_on:
  - 054-upload-ci-claude-traces-as-artifacts
supersedes: null
---

## Intent

Spec 054 added basic CI trace upload steps with 7-day retention and generic artifact naming. This spec refines and completes the feature: standardises artifact naming to `traces-intent-<run_id>-<job>` / `traces-slice-<run_id>-<job>`, raises retention to 30 days, extracts the `/retro` CI fetch logic into a standalone `scripts/agentic/traces-fetch.ts` helper with colocated tests, adds `.claude/traces-mirror/` to `.gitignore`, and updates `/retro` Step 2 to call the script with `[ci]`/`[local]` provenance labels on findings. Together these changes give the retrospective skill uninterrupted visibility into headless pipeline behaviour.

## Constraints

- All existing `claude-traces-*` artifact names must be replaced; no backwards-compatible aliases
- Retention raised from 7 to 30 days across all trace upload steps
- Duplicate upload step in the `intent.yml` scaffold job must be deduplicated to one step
- `traces-fetch.ts` must exit 0 even when `gh` fails (best-effort; silent skip on error)
- `.claude/traces-mirror/` must be in `.gitignore` (analogous to the existing `.claude/traces` entry)
- No changes to `hooks.ts` or `trace-scan.ts` — only wiring and configuration

## Acceptance criteria

- [ ] `intent.yml` align job uploads artifact named `traces-intent-${{ github.run_id }}-align` with `retention-days: 30`
- [ ] `intent.yml` scaffold job uploads artifact named `traces-intent-${{ github.run_id }}-scaffold` with `retention-days: 30`; the duplicate `claude-traces-${{ github.run_id }}` step is removed
- [ ] `slice.yml` implement-slice job uploads artifact named `traces-slice-${{ github.run_id }}-implement-slice` with `retention-days: 30`
- [ ] `scripts/agentic/traces-fetch.ts` exists, accepts `--since <duration|ISO-date>` (default 7d), downloads matching artifacts to `.claude/traces-mirror/<run_id>/`, exits 0 on any `gh` error
- [ ] `scripts/agentic/traces-fetch.test.ts` exists with mocked `gh` calls asserting window filtering, file placement, and error swallowing
- [ ] `.gitignore` contains `.claude/traces-mirror/`
- [ ] `/retro` SKILL.md Step 2 calls `bun scripts/agentic/traces-fetch.ts --since <window>`, scans `traces/*.jsonl` labeled `[local]` and `traces-mirror/**/*.jsonl` labeled `[ci]`

## Context

- Issue: #117
- Builds on spec 054 (archived 2026-04-30-054-upload-ci-claude-traces-as-artifacts)
- `scripts/agentic/trace-scan.ts` — aggregator; already accepts multiple input paths
- `.github/workflows/intent.yml` / `slice.yml` — have upload steps from spec 054 with wrong names/retention
- `.claude/skills/retro/SKILL.md` Step 2 — has inline `gh run download` block from spec 054 (to be replaced)
