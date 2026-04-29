# Tester review — 049 slice 9 (attempt 1)

**Verdict**: PASS

## Rubric

### Item 0: RED proven
exit_code: 1, 37 fail / 0 pass. Failures all root-cause to `automerge.yml not found` — gate is RED for the right reason (target file absent). Not 0/124/127. RED confirmed.

### Item 1: Acceptance criterion coverage
YES. Slice 9 contract (alignment + proposal AC #9 + tasks.md description) maps cleanly:
  - AC: triggers (workflow_run.completed) → `automerge.yml: trigger events (structural)` (3 tests) ✓
  - AC: permissions contents/pull-requests/issues/actions → `automerge.yml: permissions block` (5 tests) ✓
  - AC: concurrency PR-keyed + cancel-in-progress → `automerge.yml: concurrency block` (4 tests) ✓
  - AC: DAG-done aggregator → `aggregator gate — DAG done check` (2 tests) ✓
  - AC: outer BDD gate aggregator → `aggregator gate — outer BDD gate` (2 tests) ✓
  - AC: preview e2e aggregator → `aggregator gate — preview e2e check` (1 test) ✓
  - AC: early-green spec-gap detection + `gh issue comment` + merge guard → `early-green detection (spec gap guard)` (4 tests) ✓
  - AC: squash-merge + --delete-branch + PR-number variable → `squash merge` (3 tests) ✓
  - AC: close issue after merge (post-order) → `issue close after merge` (3 tests) ✓
  - AC: archive spec (post-order) → `spec archive step` (2 tests) ✓
  - AC: failure fan-in via `bun scripts/issue-options.ts` + `gh issue comment` + if-guard → `failure fan-in` (4 tests) ✓
  - AC: runner ubuntu-latest → `runner` ✓
  - AC: checkout v4 fetch-depth:0 → `checkout step` (2 tests) ✓

### Item 2: Adversarial gap
YES (minor). Several `run.includes(...)` matchers use broad disjunctions (e.g., DAG-done step is satisfied by `(GREEN|green) AND (tasks.md|slice|git log|dag)`). An implementer could in principle pack multiple keywords into a single dummy bash step (`echo "GREEN tasks.md slice dag git log"`) to satisfy several gate-existence tests at once. Mitigated, however, by the breadth of independent assertions (37 across distinct concerns: post-merge ordering, if-guards, --delete-branch flag, PR-variable usage, gh issue comment vs gh pr comment) — satisfying all simultaneously without an actually structurally correct workflow is impractical. Cosmetic, not structural.

### Item 3: Coverage gap
NO. The contract surface (triggers, permissions, concurrency, three aggregator gates, early-green guard, merge, close, archive, failure fan-in, runner, checkout) is fully exercised. Step ordering covered for issue-close and archive (post-merge). Failure-step `if:` guard explicitly tested. Spec-gap branch tested for both the comment posting AND the merge-step exclusion guard.

### Item 4: Behavior vs implementation detail
YES — tests are structurally pinned via `parseYaml` of the workflow document; assertions target trigger types, permissions keys, concurrency cancel-in-progress, step ordering, and `gh` CLI surface. Step matchers use `run.includes(...)` over the contract-level CLI surface (`gh pr merge --squash`, `gh issue close`, `gh issue comment`, `bun scripts/issue-options.ts`, `bun test tests/automation-pipeline.test.ts`) which is the actual public contract, not internal naming. One pragmatic raw-text fallback in concurrency PR-number test is acceptable because GH Actions `${{ ... }}` expressions are not evaluated at YAML parse time.

## Verdict summary
PASS. Gate is genuinely RED (target file absent), every slice-9 contract bullet from the alignment/proposal/tasks-9 description maps to at least one structural assertion, no testable property is uncovered, and tests pin behavior via parsed YAML + CLI surface (not implementation detail). Adversarial gap noted is cosmetic and broadly mitigated by assertion count and independence. Freezing slice 9 gate.
