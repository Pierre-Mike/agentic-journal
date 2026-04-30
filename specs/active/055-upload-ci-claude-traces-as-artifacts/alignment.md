---
created: 2026-04-30
status: confirmed
confidence: high
intent_hash: 8ee32b33cd2b
---

## Goal

CI runs that invoke Claude via `claude -p` in `intent.yml` and `slice.yml` produce structured observability traces at `.claude/traces/<session>.jsonl` via `hooks.ts`. These files are ephemeral: the runner discards them when the job ends. A prior attempt (spec 054, archived 2026-04-30) added basic upload steps with 7-day retention and generic artifact naming. Issue #117 refines and completes the feature: standardise artifact naming to `traces-intent-<run_id>-<job>` / `traces-slice-<run_id>-<job>`, raise retention to 30 days, extract the `/retro` fetch logic into a standalone `scripts/agentic/traces-fetch.ts` helper with tests, add `.claude/traces-mirror/` to `.gitignore`, and update `/retro` Step 2 to call the script and label findings with `[ci]` / `[local]` provenance. Together these changes give the retrospective skill uninterrupted visibility into headless pipeline behaviour — the most signal-rich and least-observed part of the system.

## Big Picture

The feature has two halves that compose but can be understood independently:

```
CI runner (intent.yml / slice.yml)
  └─ claude -p runs → hooks.ts emits .claude/traces/<session>.jsonl
       └─ [PARTIAL: spec 054] upload-artifact step
            current: name=claude-traces-<run_id>, retention=7d
            target:  name=traces-intent-<run_id>-<job>
                          traces-slice-<run_id>-<job>
                     retention-days: 30
                     if-no-files-found: ignore

Developer / CI cron running /retro
  └─ Step 2 (Gather signal)
       └─ [PARTIAL: spec 054] inline gh run list + gh run download
            → .claude/traces-ci/**/*.jsonl
            target: bun scripts/agentic/traces-fetch.ts --since <window>
                     → .claude/traces-mirror/<run_id>/
                     → dual-source scan with [ci]/[local] labels
                     → .claude/traces-mirror/ in .gitignore
```

Existing pieces this spec builds on:
- `scripts/agentic/trace-scan.ts` — aggregator; already accepts multiple input paths
- `.claude/hooks/observe.ts` — trace writer; session-scoped JSONL
- `.github/workflows/intent.yml` / `slice.yml` — already have upload steps from spec 054
- `.claude/skills/retro/SKILL.md` Step 2 — already has inline CI fetch from spec 054

## Straightforward Details

### CI artifact upload — naming and retention

```
intent.yml jobs that call claude -p:
  align job:
    current step name: "Upload Claude traces"
    current artifact: claude-traces-align-<run_id>   (7d)
    target artifact:  traces-intent-<run_id>-align    (30d)

  scaffold job:
    current step name: "Upload Claude traces as artifact"  (duplicate step exists)
    target artifact:  traces-intent-<run_id>-scaffold      (30d)
    action: deduplicate the two upload steps into one

slice.yml implement-slice job:
  current artifact: claude-traces-<run_id>             (7d)
  target artifact:  traces-slice-<run_id>-implement-slice  (30d)

All upload steps:
  if: always()                  — capture failure traces
  if-no-files-found: ignore     — no-op when telemetry disabled
  retention-days: 30            — raised from 7d
  path: .claude/traces/         — unchanged
```

### traces-fetch.ts helper script

```
Location: scripts/agentic/traces-fetch.ts
CLI: bun scripts/agentic/traces-fetch.ts [--since <duration|ISO-date>]
     default --since: 7d

Algorithm:
  1. gh run list --json databaseId,createdAt,conclusion
       --workflow intent.yml --limit 50
     repeat for slice.yml
  2. Filter: createdAt >= window-start AND conclusion != null (completed)
  3. For each run_id:
       gh run download <run_id>
         --pattern 'traces-*'
         --dir .claude/traces-mirror/<run_id>/
     Best-effort: skip on gh error (missing permissions / artifact expired)
  4. Exit 0 in all cases; log skipped runs to stderr

Exit behaviour: always 0 — best-effort; /retro must not break on gh failure
```

### .gitignore

```
Add: .claude/traces-mirror/
(analogous to existing .claude/traces entry on line 11)
```

### /retro SKILL.md Step 2 update

```
Replace inline gh commands with:
  bun scripts/agentic/traces-fetch.ts --since <window>

Scan sources:
  .claude/traces/*.jsonl          → label as [local]
  .claude/traces-mirror/**/*.jsonl → label as [ci]

findings.md session IDs:
  [ci]   <session_id>  — from CI artifact
  [local] <session_id> — from interactive session
```

### traces-fetch.test.ts

```
Location: scripts/agentic/traces-fetch.test.ts   (colocated, per constitution §8)
Mocks:
  - gh run list --workflow intent.yml  → canned JSON (5 runs, 2 outside window)
  - gh run list --workflow slice.yml   → canned JSON
  - gh run download <id> ...           → touch sentinel files
Assertions:
  - Only runs within --since window are downloaded
  - Files land at .claude/traces-mirror/<run_id>/
  - gh errors are swallowed; exit 0
```

### Scope delta vs. spec 054

```
Already done (spec 054 / PR #112):
  - intent.yml upload steps exist (naming/retention wrong)
  - slice.yml upload step exists  (naming/retention wrong)
  - SKILL.md Step 2 has inline CI fetch (no script, uses traces-ci/ not traces-mirror/)

New work in this spec (055):
  - Rename artifacts to traces-intent-*/traces-slice-* naming convention
  - Raise retention-days 7 → 30
  - Extract fetch logic to scripts/agentic/traces-fetch.ts
  - Add scripts/agentic/traces-fetch.test.ts
  - Add .claude/traces-mirror/ to .gitignore
  - Update SKILL.md Step 2 to call the script, scan traces-mirror/, emit [ci]/[local] labels
  - Deduplicate the double upload-artifact step in intent.yml scaffold job
```

## Non-obvious Decisions

### Decision 1: traces-mirror/ vs. traces-ci/ directory name

Recommended: `.claude/traces-mirror/` as specified in the intent. This matches the
intent's explicit acceptance criteria and makes the directory's purpose clearer
("mirror of what CI produced") than "traces-ci". Spec 054's design used `traces-ci/`
because that was the convention at the time; issue #117 supersedes it.

Rejected: keeping `traces-ci/` — would leave the SKILL.md and the new script
out of sync with the intent's stated acceptance criteria; intent is authoritative.

### Decision 2: Dedicated fetch script vs. inline gh commands in SKILL.md

Recommended: `scripts/agentic/traces-fetch.ts` as a standalone Bun script, called
from SKILL.md. This is testable (constitution §8 — colocated test), reusable
(morning digest or other skills can call it), and replaceable without editing SKILL.md.
Inline shell commands in SKILL.md are neither testable nor easily maintained.

Rejected: inline gh commands (status quo from spec 054) — untestable, not reusable,
violates the constitution's preference for deterministic enforcement over skill-based
judgment (§2: if it can be expressed as a script, it must not be a skill step).

### Decision 3: spec kind — workflow vs. code

Recommended: `kind: workflow`. The deliverables are YAML workflow changes, a helper
script, and a SKILL.md update — no new application logic with a meaningful domain
model. The gate is a smoke script that validates the structural invariants (artifact
steps present with correct naming/retention, script exists, .gitignore entry present).
This matches constitution §4's workflow gate pattern.

Rejected: `kind: code` — would require per-slice RED/GREEN TDD gates and a
spec-judge review per slice. The changes are structural/configuration; the effort of
per-task frozen gates outweighs the benefit for what is essentially a YAML + script
wiring task.

### Decision 4: artifact naming granularity — per-job vs. per-workflow

Recommended: per-job names (`traces-intent-<run_id>-align`, `traces-intent-<run_id>-scaffold`,
`traces-slice-<run_id>-implement-slice`). This makes artifact provenance unambiguous in
the GitHub Actions UI and allows `traces-fetch.ts` to use `--pattern 'traces-*'` to
download all trace bundles from a run without collision.

Rejected: per-workflow names only (`traces-intent-<run_id>`) — within a single
`github.run_id` an intent run can have two jobs (align + scaffold) each producing
traces; GitHub artifacts must be unique per run_id, so a shared name would conflict
on upload or silently overwrite.
