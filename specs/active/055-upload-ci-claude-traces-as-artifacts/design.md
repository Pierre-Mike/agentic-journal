# Design

Wiring and naming fix across three independent surfaces: CI YAML artifact steps, a new Bun helper script, and a SKILL.md instruction update.

## Approach

Three slices with a simple DAG: slices 1 (CI YAML) and 2 (traces-fetch script) are parallel-safe; slice 3 (gitignore + SKILL.md) depends on slice 2 because the SKILL.md update calls the script whose CLI must be established first.

1. **CI YAML** — rename `upload-artifact` steps in `intent.yml` (align + scaffold jobs) and `slice.yml` (implement-slice job). Fix `retention-days` 7→30. Deduplicate the two scaffold upload steps to one.
2. **traces-fetch.ts** — new Bun script at `scripts/agentic/traces-fetch.ts` with colocated `traces-fetch.test.ts`. Lists completed runs for both `intent.yml` and `slice.yml` via `gh run list`, filters by `--since` window, downloads matching artifacts (`--pattern 'traces-*'`) to `.claude/traces-mirror/<run_id>/`. Skips silently on any `gh` error; exits 0 in all cases.
3. **gitignore + SKILL.md** — add `.claude/traces-mirror/` to `.gitignore`; replace the inline `gh run download` block in SKILL.md Step 2 with `bun scripts/agentic/traces-fetch.ts --since <window>` and update the scan source list to cover both `traces/*.jsonl` ([local]) and `traces-mirror/**/*.jsonl` ([ci]).

## Files touched

- `.github/workflows/intent.yml` — rename 2 upload steps, raise retention, remove duplicate step
- `.github/workflows/slice.yml` — rename 1 upload step, raise retention
- `scripts/agentic/traces-fetch.ts` — new: CI artifact downloader with `--since` window filter
- `scripts/agentic/traces-fetch.test.ts` — new: colocated unit tests with mocked `gh` subprocess
- `.gitignore` — add `.claude/traces-mirror/`
- `.claude/skills/retro/SKILL.md` — update Step 2: replace inline gh block, add traces-mirror scan, add [ci]/[local] labels

## Decisions

- **traces-mirror/ vs traces-ci/** — `traces-mirror/` matches issue #117's acceptance criteria; `traces-ci/` was spec 054's provisional convention. Issue #117 is authoritative, spec 054 is archived.
- **Dedicated script vs inline sh** — `traces-fetch.ts` is testable (colocated test, §8), reusable by morning-digest or other skills, and replaceable without editing SKILL.md. Inline `gh` commands in SKILL.md are untestable and not reusable.
- **kind: code** — `traces-fetch.ts` has non-trivial window-filtering and error-swallowing logic that warrants slice-RED TDD; per-slice gates give implementer clear pass/fail feedback on each deliverable.
- **Per-job artifact names** — `traces-intent-<run_id>-align` and `traces-intent-<run_id>-scaffold` are unique within a single run; `--pattern 'traces-*'` in `traces-fetch.ts` picks them all up without name collision.

## Risks

- `gh run download` rate limiting on large history windows — mitigated by `--limit 50` cap and 7d default for `--since`.
- A future workflow adding a second job that uploads the same artifact name — mitigated by the per-job suffix convention; any collision becomes a CI error rather than silent overwrite.

## Out of scope

- Changes to `hooks.ts` or `trace-scan.ts`
- Automatic cleanup / deletion of existing `claude-traces-*` artifacts already stored in GitHub
- Changing the upload source path (`.claude/traces/` is correct and unchanged)
