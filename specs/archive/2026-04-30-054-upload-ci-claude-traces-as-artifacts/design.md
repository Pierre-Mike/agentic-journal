# Design

## Approach

Two orthogonal changes:

1. **Write side** — add a two-line `upload-artifact` step to each of the three Claude-invoking workflows (slice.yml, intent.yml, claude.yml). The step runs unconditionally (`if: always()`) after the final Claude invocation so failure traces are captured.

2. **Read side** — update `/retro` SKILL.md Step 2 with a "CI artifact traces" sub-section that describes the `gh run list` + `gh run download` flow, fetching into `.claude/traces-ci/` and merging with local `.claude/traces/` before aggregation.

The gate script `scripts/smoke-ci-traces-upload.ts` validates both halves deterministically.

## Files touched

- `.github/workflows/slice.yml` — add `upload-artifact` step after the Claude invocation step
- `.github/workflows/intent.yml` — same
- `.github/workflows/claude.yml` — same
- `.claude/skills/retro/SKILL.md` — update Step 2 with CI artifact traces sub-section

## Decisions

- **Direct YAML vs. composite action** — upload step added directly to each workflow. The step is two lines of YAML; a composite action requires a new `.github/actions/` directory and its own `action.yml`, adding scaffolding overhead that outweighs the duplication avoided at this scale.

- **`if: always()` on upload** — traces from failing CI runs are the most valuable for retrospective debugging. Sessions that hit retries, blocks, or errors are exactly what `/retro` should surface. Uploading only on success would hide failure signal.

- **Fetch into `.claude/traces-ci/`** — sibling directory preserves provenance (CI vs. interactive sessions are distinguishable) and avoids clobbering live local trace files on the off-chance of a session_id collision.

- **Best-effort CI fetch in `/retro`** — `/retro` is also invoked locally by humans without artifact download context; hard failure on `gh` errors would break interactive use. Best-effort with a logged warning is the correct posture.

## Risks

- `gh run download` requires `actions: read` permission; best-effort design absorbs permission failures gracefully without breaking local `/retro` invocations.

## Out of scope

- Changes to `scripts/trace-scan.ts` (already accepts `--traces-dir`)
- Active cleanup steps (GitHub expires artifacts after 7 days automatically)
- Deduplication logic beyond session_id (aggregator handles this)
- Composite action abstraction for the upload step
