# Design

## Approach

Add a workflow-scope `permissions:` block to `.github/workflows/preview.yml`,
then extend the existing zero-dep gate `scripts/smoke-preview-workflow.ts` with
a permissions-block locator that asserts `pull-requests: write`. Add a
`PREVIEW_WORKFLOW_PATH` env override so a colocated bun:test file can point the
gate at tmp fixtures to verify both the missing-block (exit 1) and present-block
(exit 0) cases.

## Files touched

- `.github/workflows/preview.yml` — insert workflow-scope permissions block
  (`contents: read`, `pull-requests: write`) above `jobs:`.
- `scripts/smoke-preview-workflow.ts` — add `PREVIEW_WORKFLOW_PATH` env override
  and a new assertion for the permissions block.
- `scripts/smoke-preview-workflow.test.ts` — new colocated bun:test with
  missing/present fixture cases.

## Decisions

- **Workflow-scope permissions block, not job-scope.** Matches the workflow
  purpose; any future job in this workflow will also interact with the PR.
  Job-scope would require repeating the block for each job.
- **Extend existing regex/string gate style, no YAML parser.** Consistent with
  the existing gate; no new deps; we control the workflow YAML shape.
- **Inline tmp fixtures via `PREVIEW_WORKFLOW_PATH` env override.** Simpler than
  separate files under `tests/fixtures/`; does not mutate the real workflow;
  keeps the test self-contained.

## Risks

- Gate locator for top-level `permissions:` must not false-match a nested
  `permissions:` key inside a job. Mitigation: anchor the regex at start-of-line
  (column 0) so only the workflow-scope key matches.

## Out of scope

- `deploy.yml` permissions — no comment step there; current deploy pipeline does
  not need `pull-requests: write`.
- New smoke entrypoints; the existing single smoke script is extended.
