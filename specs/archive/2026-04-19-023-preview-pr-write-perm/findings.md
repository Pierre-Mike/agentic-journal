# Retrospective findings — 2026-04-19 (window: last 7 days)

Window: 2026-04-12 → 2026-04-19
Signal sources: 23 merged PRs, 7 traces (438 events), archived specs 015–022.

## 1. Preview (PR) workflow silently red on every PR — ACTED ON (this spec)

- **Signal**: PRs 34, 36, 38, 39, 41, 42, 43 all failed on the "Comment preview URL" step with HTTP 403 `Resource not accessible by integration` targeting `POST /repos/:owner/:repo/issues/:num/comments`.
- **Hypothesis**: `.github/workflows/preview.yml` has no `permissions:` block; default `GITHUB_TOKEN` is read-only on `pull-requests`.
- **Proposed action**: Add workflow-scope `permissions: { contents: read, pull-requests: write }` and extend `scripts/smoke-preview-workflow.ts` to assert it.
- **Kind**: workflow
- **Status**: authored as spec 023 (this folder).

## 2. Deferred: main red for 4 consecutive merges before env-var fix propagated

- **Signal**: Deploy (production) runs 24, 25, 26, 27, 28 failed with `CLOUDFLARE_API_TOKEN missing`. Even the merge of the fix (PR 21, spec 020) produced a red Deploy 28; green only resumed at run 29 after subsequent merges inherited the fix.
- **Hypothesis**: Spec-level smoke gates assert workflow YAML shape but cannot catch a live CI failure on `main`. No branch-protection rule blocks merging while `main`'s most recent Deploy is red.
- **Proposed action**: Add a pre-merge check or a `scripts/main-health.ts` gate that queries `gh run list -b main -w "Deploy (production)"` and blocks PRs when the last Deploy is red (or at least surfaces it loudly in `/do`'s Step 9).
- **Kind**: rule (or workflow)

## 3. Deferred: drift detector fires on intentional cross-repo plans writes

- **Signal**: Session 60d35b9d recorded 20+ Write/Edit events on `/Users/pierre-mikel/Github/Claude-research/.claude/plans/research-agentic-journal-gap-registry.md`, all flagged as drift by `scripts/trace-scan.ts`.
- **Hypothesis**: Cross-repo `.claude/plans/` writes are legitimate agent workspaces, not drift. Detector lacks an allowlist.
- **Proposed action**: Add path-glob allowlist (e.g. `**/.claude/plans/**`) to drift detection in `scripts/trace-scan.ts`. Keep drift alarm for other out-of-repo writes.
- **Kind**: code

## 4. Noted (no action): high loop churn in TDD sessions

- **Signal**: Session cf2060e3 logged 14 loop triples on RED→GREEN iteration files.
- **Hypothesis**: Normal TDD churn; not a pathology.
- **Status**: partially addressed by 016-red-commit-gate + 018-tdd-importance. No new spec.
