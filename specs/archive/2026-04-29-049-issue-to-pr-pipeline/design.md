## Approach

The pipeline has two distinct layers:

**Orchestration layer** (GitHub Actions YAML): five workflows wired by events. No custom code in the YAML beyond shell glue and `gh` CLI calls. The heavy logic lives in TypeScript scripts invoked by the workflows.

**Controller layer** (TypeScript scripts): `dag-controller.ts` implements the DAG + touches-intersection evaluation that makes parallel dispatch safe. `issue-options.ts` generates the failure menu. Both are locally unit-testable without GitHub.

### Flow summary

1. `bootstrap.yml` — triggered by `issues.opened|edited` + `issue_comment.created`. Creates branch `auto/<issue#>-<slug>`, opens draft PR, runs `/do-auto`. On `confidence: high`, commits `alignment.md`.
2. CODEOWNERS freezes `specs/active/*/alignment.md` after commit.
3. `controller.yml` — cron ~2min. Parses `tasks.md`, calls `dispatchable()`, fires `repository_dispatch` for each ready slice.
4. `slice.yml` — receives dispatch, runs `claude -p` with expertise skill, does `pull --rebase && push` with retry.
5. `preview.yml` — on every push: `wrangler versions upload`, post URL, playwright e2e, BDD outer gate.
6. `automerge.yml` — on check completion: asserts DAG-done + outer-gate-✓ + preview-e2e-✓, squash-merges, closes issue.

### DAG controller algorithm

```
dispatchable(slices, done, inFlight):
  inFlightTouches = union of touches arrays across inFlight slices
  return slices where:
    slice.id not in done
    AND slice.id not in inFlight.ids
    AND all(dep in done for dep in slice.depends_on)
    AND intersection(slice.touches, inFlightTouches) == empty
```

### Failure path

After 3 retries, `slice.yml` calls `issue-options.ts` to generate a markdown menu and posts it as an issue comment via `gh issue comment`. The PR stays draft. `issue_comment.created` re-triggers `bootstrap.yml` / `controller.yml` which parse the user's reply.

## Files Touched

| Slice | File |
|-------|------|
| 1 | `specs/_template/tasks.md`, `scripts/spec-lint.ts` |
| 2 | `scripts/dag-controller.ts` |
| 3 | `scripts/issue-options.ts` |
| 4 | `.github/CODEOWNERS` |
| 5 | `.github/workflows/bootstrap.yml` |
| 6 | `.github/workflows/controller.yml` |
| 7 | `.github/workflows/slice.yml` |
| 8 | `.github/workflows/preview.yml` |
| 9 | `.github/workflows/automerge.yml` |
| 10 | `tests/automation-pipeline.test.ts` (gate update only) |

## Decisions

**Single feature branch, not child PRs.** User chose review simplicity over isolation. `touches:` + `pull --rebase` handles the resulting push races.

**BDD outer gate RED until last slice.** Early-green detection (outer gate passes before slice 10) means a deliverable was missing from the spec. The preview workflow reports this as a bot comment "spec gap detected".

**`touches:` extends `depends_on:`.** Pure DAG catches explicit orderings; `touches:` catches implicit file conflicts (shared lockfile, registry, barrel, tasks.md itself). Both are necessary.

**CODEOWNERS freeze, not branch protection.** No admin config required; rule is in-tree and visible to reviewers.

**`kind: code` not `kind: workflow`.** `dag-controller.ts` has real algorithmic logic (set operations on DAG state) that justifies TDD isolation. Workflow YAML is config; controller is code.

## Out of Scope

- Child-PR-per-slice isolation
- Rollback of failed slice commits
- Multi-repo dispatch
- Notification channels other than issue comments
- Slice splitting logic (user-driven menu option; implementation deferred to `issue-options.ts` docs)
