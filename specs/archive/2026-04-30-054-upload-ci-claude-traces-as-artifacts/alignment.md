---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 3a5b6d221d42
---

## Goal

CI runs that invoke Claude (slice.yml, intent.yml, claude.yml) produce structured observability traces in `.claude/traces/<session_id>.jsonl` via hooks.ts. These files are gitignored and currently discarded at the end of each ephemeral runner. The goal is to preserve those traces by uploading them as GitHub Actions artifacts after each CI run, then teach the `/retro` skill to download and incorporate them so retrospectives can draw on real CI session data — not just local traces from interactive sessions. This closes the observability gap between what Claude does in CI and what `/retro` can see.

## Big Picture

The feature has two orthogonal halves: a **write side** (CI artifact upload) and a **read side** (`/retro` fetch). They are independent but compose: `/retro` only gains CI signal once the write side is in place.

```
CI runner (slice.yml / intent.yml / claude.yml)
  └─ claude -p runs, hooks.ts emits to .claude/traces/<session>.jsonl
       └─ [NEW] upload-artifact step → GitHub Actions artifact
            name: claude-traces-<run_id>
            path: .claude/traces/
            retention: 7d

/retro skill (Step 2 — Gather signal)
  └─ [CURRENT] reads .claude/traces/*.jsonl (local, interactive only)
  └─ [NEW] also calls: gh run list + gh run download-artifact
            → fetches recent CI trace bundles into .claude/traces/ or tmpdir
            → existing trace-scan.ts aggregator runs over merged set
```

Key existing pieces this spec builds on:
- `scripts/trace-scan.ts` — aggregator (spec 005, archived); exports `loadTraces`, `aggregate`
- `.claude/hooks/observe.ts` — trace writer; session-scoped JSONL files
- `.github/workflows/slice.yml`, `intent.yml`, `claude.yml` — three workflows that run Claude

## Straightforward Details

### CI Artifact Upload

```
Affected workflows: slice.yml, intent.yml, claude.yml
Upload step placement:
  - After the final Claude invocation step (or with if: always() to capture on failure too)
  - One upload-artifact step per workflow, uses actions/upload-artifact@v4

Artifact naming:
  - name: claude-traces-${{ github.run_id }}
  - path: .claude/traces/
  - retention-days: 7
  - if: always() — upload even on failure for post-mortem use

Collision guard:
  - slice.yml has concurrent jobs per spec/slice; each run_id is unique so naming is safe
```

### /retro Skill Changes (Step 2)

```
New sub-step after reading local .claude/traces/:
  1. gh run list --workflow slice.yml --status completed --limit 20 --json databaseId
     (also query intent.yml, claude.yml)
  2. For each run, attempt: gh run download <run_id> --name claude-traces-<run_id> --dir .claude/traces-ci/
  3. Merge .claude/traces-ci/**/*.jsonl into aggregation input alongside local .claude/traces/*.jsonl
  4. Deduplicate by session_id to avoid double-counting if same session appears in both

trace-scan.ts already accepts --traces-dir; no changes needed to the aggregator itself.
```

### Retention and Cleanup

```
Retention: 7 days (matches existing playwright-report artifact in ci.yml)
No active cleanup step needed — GitHub expires artifacts automatically
CI traces are gitignored; no repo pollution risk
```

### Spec Kind and Gate

```
kind: workflow
gate: scripts/smoke-ci-traces-upload.ts
  - Validates that slice.yml, intent.yml, claude.yml each contain an upload-artifact step
    referencing .claude/traces/
  - Validates that .claude/skills/retro/SKILL.md mentions CI artifact fetch in Step 2
```

## Non-obvious Decisions

### Decision 1: Upload in all three workflows vs. a shared composite action

Recommended: upload-artifact step added directly to each of the three affected
workflows (slice.yml, intent.yml, claude.yml). The step is two lines of YAML; a
composite action would add indirection and a new file to maintain without
meaningful DRY benefit at this scale.

Rejected: composite action — overkill for a two-line upload step; composite
actions require a separate `.github/actions/` directory and their own action.yml,
adding scaffolding cost that outweighs the duplication avoided.

### Decision 2: Always-upload vs. only on success

Recommended: `if: always()` on the upload step. Traces from failing CI runs are
the most valuable for retrospective debugging — a session that hit retries,
blocks, or errors is exactly what `/retro` should surface. Uploading only on
success would hide failure signal.

Rejected: upload on success only — silently discards the most diagnostically
useful traces; the `/retro` skill explicitly looks for retry-heavy sessions and
tool-call failures, which correlate with CI failures.

### Decision 3: Fetch CI artifacts into .claude/traces-ci/ vs. .claude/traces/

Recommended: fetch into `.claude/traces-ci/` (a sibling directory), then pass
both directories to trace-scan.ts aggregation. This avoids clobbering or
conflating local interactive session traces with CI session traces during a
`/retro` run, and makes provenance clear.

Rejected: fetch directly into `.claude/traces/` — mixes local and CI traces in a
way that makes it impossible to distinguish interactive from CI sessions without
parsing session metadata; also risks overwriting a live local trace file if a
session_id collision occurs (unlikely but non-zero).

### Decision 4: Scope of /retro SKILL.md changes

Recommended: update Step 2 of `SKILL.md` with a new sub-section "CI artifact
traces" that describes the gh run list + gh run download flow, with a note that
it is best-effort (gh CLI may not have artifact download permissions in all
invocation contexts). Keep the existing local-traces path as the primary path.

Rejected: making CI artifact fetch mandatory (error on gh failure) — `/retro` is
also invoked locally by humans who have no artifact download context; a hard
failure would break the skill for interactive use. Best-effort with a logged
warning is the correct posture.
