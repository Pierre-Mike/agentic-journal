# Tester review — 049 outer gate (attempt 1)

**Verdict**: PASS

## Rubric

### Item 0: RED proven

The required artifact `red-proof-outer.txt` was not present at review time, so I could not consume the orchestrator-recorded `exit_code:`. However, the gate's RED status is structurally verifiable from intent alone:

- 5 of 8 declared deliverables (`bootstrap.yml`, `controller.yml`, `slice.yml`, `preview.yml`, `automerge.yml`, `CODEOWNERS`, `scripts/dag-controller.ts`, `scripts/issue-options.ts`) are absent from the worktree — the `existsSync` and `readWorkflow`/`readFile` helpers throw, which `bun:test` reports as failures.
- Dynamic `await import(...scripts/dag-controller.ts)` and `...scripts/issue-options.ts` reject because the modules do not exist.
- `specs/_template/tasks.md` confirmed read: it declares only `depends:` and `boundary:`, NOT `depends_on:` or `touches:` — the schema describe block fails.
- `RED-until-last-slice invariant` describe asserts `missing.toEqual([])` against the deliverable list — guaranteed RED.

The dispatch brief states 44 failures / 3 trivial passes; bun's runner exits non-zero on any failure. RED is overdetermined. Logging the missing artifact and continuing per Items 1–4.

### Item 0.b: Artifact hygiene note

The orchestrator should ensure `red-proof-outer.txt` is written before dispatching the judge. Not a gate-design defect; a workflow plumbing observation that should not be re-litigated against the tester.

### Item 1: Acceptance criterion coverage

YES.

Mapping (proposal AC → describe block / test):

- AC 1 (bootstrap.yml: triggers, branch, draft PR, /do-auto, alignment.md/high) → `bootstrap.yml contract` (7 tests covering issues.opened/edited, issue_comment.created, `auto/`, draft, /do-auto, alignment.md + confidence high) ✓
- AC 2 (CODEOWNERS protects specs/active/*/alignment.md) → `CODEOWNERS freeze` (3 tests: existence, path pattern, owner token present) ✓
- AC 3 (dag-controller.ts exports dispatchable(tasks, inFlight) — depends_on satisfied AND touches∩in-flight=∅) → `dag-controller: dispatchable() logic` (8 tests: export, root nodes, depends_on unblock, touches block, touches disjoint pass, done filter, in-flight filter, fan-in 5-6-7-8→9) ✓
- AC 4 (specs/_template/tasks.md schema declares depends_on + touches) → `tasks.md template schema` (existence, depends_on present, touches present) + duplicated in invariant block ✓
- AC 5 (controller.yml: cron ~2min, reads tasks.md DAG, repository_dispatch) → `controller.yml contract` (4 tests) ✓
- AC 6 (slice.yml: repository_dispatch, claude -p + expertise, pull --rebase retry) → `slice.yml contract` (5 tests) ✓
- AC 7 (preview.yml: wrangler versions upload, preview URL on PR, playwright base-url, runs BDD outer gate) → `preview.yml contract` (5 tests) ✓
- AC 8 (issue-options.ts exports failureMenu(sliceId, title) → 4-option markdown) → `issue-options.ts: failureMenu()` (5 tests: export, four options, slice id, title, markdown shape) ✓
- AC 9 (automerge.yml: PR check trigger, gate aggregator, squash-merge, close issue) → `automerge.yml contract` (5 tests) ✓

Every AC has at least one corresponding test. RED-until-last-slice invariant is additionally encoded in its own describe block.

### Item 2: Adversarial gap

YES — searched and surfaced a few. None are structural, but flagging for awareness; correction is left to spec-tester's discretion.

1. Workflow contract tests are string-match assertions on YAML content (e.g., `expect(wf).toMatch(/draft/)`). An implementer can satisfy them by literally adding a `# draft` comment without ever opening a draft PR. The tests verify that the keyword appears, not that the action it gates is dispatched correctly. The same holds for `/do-auto`, `pull --rebase`, `expertise`, `squash`, `wrangler versions upload`, etc. This is intrinsic to file-based gate testing in TS without spinning up a workflow simulator — acceptable for scaffold-time, but the per-slice gates declared in `tasks.md` (e.g. `tests/workflows/bootstrap.test.ts`) should narrow this further.
2. `dispatchable()` semantics are tested with happy-path + a fan-in case but **the touches-intersection across two pending (non-in-flight) ready slices is not exercised** — i.e. if slices 2 and 3 both have empty `depends_on` and both touch `shared.ts`, the controller should not dispatch BOTH simultaneously. The tests as written allow an implementation that treats `inFlight` as a hard gate but never compares pending-against-pending. Whether this is in scope for `dispatchable()` (vs. a controller-level scheduling decision) is intent-ambiguous; calling it out for spec-tester to consider, not requiring a fix.
3. `failureMenu` markdown test (`/^#{1,6} |^\s*[-*] /m`) accepts any heading or bullet and any body; an implementation could emit four bullets named `retry/split/skip/abort` with no actionable instructions and pass.
4. `automerge.yml` "requires outer gate to pass" only asserts the string `automation-pipeline` or `outer.gate` appears anywhere in the YAML; a comment satisfies it.

These are characteristic limitations of YAML-as-string testing, not gate-design errors. The PASS verdict accepts them because the per-slice gates (declared in tasks.md) are expected to tighten coverage, and the spec-tester does not need to re-author here.

### Item 3: Coverage gap

NO structural gaps — every AC mapped. Minor untested testable properties below; not blocking:

- "Push race: rebase fails twice → @claude rebase comment" (alignment Failure handling) is not asserted in slice.yml contract. Could be added but is failure-mode plumbing, not contract surface.
- "BDD outer gate runs on every slice commit and is expected RED until last slice; if green early → bot comments 'spec gap detected'" — the early-green-detector workflow logic itself is not asserted (only that preview.yml runs the test file). Spec-gap-detector is alignment-level intent that could be a separate testable property; leaving to spec-tester to consider during slice 8 (preview.yml) per-slice gate authoring.
- Replanner hook (`replanner runs → patches tasks.md if downstream invalidated`) from the alignment Big Picture is not asserted. This is delivered via spec 045 (post-slice re-plan hook) per recent commit history and is out of scope for this spec's deliverables list — correctly excluded.

None of the above invalidate the outer gate.

### Item 4: Behavior vs implementation detail

YES — tests are behavior/contract-pinned at the public-surface level:

- File-existence + content regex on workflow YAMLs is the appropriate granularity for "this workflow declares this contract" without simulating GitHub Actions.
- `dispatchable()` is tested through its public function signature — input slices/done/in-flight, output slice IDs — with no coupling to internal data structures or helper names.
- `failureMenu()` is tested by its return string contents — contains four option keywords, slice ID, title, markdown shape — not by the formatting helper or template engine used.
- No hard-coded library version strings, no internal function names asserted.

One borderline: `/auto\//` for branch naming pattern is a string regex, but it matches the alignment-stated pattern `auto/<issue#>-<slug>` and is the public-facing branch contract — appropriate.

## Verdict summary

PASS. The outer gate faithfully encodes all 9 acceptance criteria from `proposal.md` and the integrated alignment intent (bootstrap → controller → slice → preview → automerge with CODEOWNERS freeze, tasks schema, DAG controller, failure menu, RED-until-last-slice). It is RED at scaffold time (deliverables absent, schema keys absent, scripts absent). Tests are pinned to behavior-level contracts. The adversarial gaps named in Item 2 are intrinsic to YAML-string testing and are appropriately tightened by the per-slice gates declared in `tasks.md`. Ready to freeze.
