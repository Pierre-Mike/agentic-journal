# Tester review — 049 slice 6 (attempt 1)

**Verdict**: PASS

## Rubric

### Item 0: RED proven
exit_code: 1 (31 fail / 0 pass). controller.yml does not exist; all parseWorkflow() calls throw. Genuine RED, not tautological. Confirmed.

### Item 1: Acceptance criterion coverage
YES.

Slice-6 AC: "controller.yml runs on schedule: cron (~2min), reads tasks.md DAG, dispatches ready slices via repository_dispatch." Decomposed into testable sub-properties + auxiliary contract from proposal/alignment:

Mapping:
  - cron ~2min → `on.schedule[0].cron is a ~2-minute interval` (regex `^\*\/[12]\s+\*\s+\*\s+\*\s+\*$`) ✓
  - repository_dispatch trigger → `on.repository_dispatch is present` ✓
  - workflow_dispatch trigger (manual nudge) → `on.workflow_dispatch is present` ✓
  - reads tasks.md DAG → `a step invokes bun scripts/dag-controller.ts` + `dag-controller step references tasks.md` ✓
  - dispatches ready slices → dispatch loop block (`gh workflow run slice.yml` / `gh api dispatches` / `repository_dispatch`) ✓
  - parallel, no cap (alignment) → no max-parallel cap asserted; not a positive test, but absence is correct (the no-cap property is a non-assertion) ✓
  - permissions to dispatch → contents:read, pull-requests:write, actions:write ✓
  - concurrency (queue, don't cancel running controller) → group references github.ref + 'controller' identifier + cancel-in-progress: false ✓
  - in-flight derivation (touches∩in-flight=∅ feeds findDispatchable) → in-flight detection step (`gh run list` + `slice.yml` + `--json`/`gh api`) ✓
  - completed slices derivation (depends_on satisfied feed) → completed-slices step + GREEN commit pattern ✓
  - dispatch payload (slice_id, spec_id, branch) → three separate tests asserting each field ✓
  - no-op when nothing dispatchable → if: guard OR run-block short-circuit + no unconditional `exit 1` ✓
  - runner + checkout (needed for git log) → ubuntu-latest + actions/checkout@v4 + fetch-depth: 0 ✓

Every slice-6 AC sub-property has at least one test.

### Item 2: Adversarial gap
YES — searched, found minor looseness, none structurally fatal.

The completed-slices test (line 271-279) accepts the literal "GREEN" substring **anywhere in raw YAML**, not in a specific step's `run:` block. An implementation could put `# uses GREEN convention` as a comment and satisfy that single test, but the companion test at line 258-269 still demands an actual step containing `git log` / `GREEN` / `completed` / `status` in its `run:` block, so the comment-only escape is closed. Net: implementation must include both a real completed-slices step and reference the GREEN convention — adversarially survivable but not tautologically.

A second observation: the in-flight, dispatch, and completed step finders use OR-matched substrings (e.g., `gh run list` + `slice.yml` OR `in_progress`). A single mega-step containing all of those substrings could satisfy "in-flight detection" + "dispatch loop" + "completed detection" simultaneously. This is acceptable because the controller is small enough that step fusion is a legitimate impl choice; tests still assert each contract substring exists. No structural gap.

### Item 3: Coverage gap
NO.

The DAG-correctness algorithm (depends_on satisfied + touches∩in-flight=∅) is owned by slice 2's `findDispatchable` and unit-tested in `scripts/dag-controller.test.ts`. Slice 6's responsibility is wiring that function into a cron-driven workflow, which the gate covers structurally. The "parallel, no cap" property is non-assertable as a positive test (it's the absence of a max-parallel limit); acceptable.

### Item 4: Behavior vs implementation detail
YES — tests pin observable workflow contract.

The gate parses YAML structurally with the `yaml` package (matching slice-5 convention) and asserts contract fields: `on.schedule`, `permissions.contents`, `concurrency.cancel-in-progress`, `steps[].uses`, `steps[].with[fetch-depth]`. Substring matching is confined to step `run:` blocks where shell content is unavoidable, and to one raw-YAML search for the GREEN commit convention. The GREEN literal is a documented convention from alignment.md and the spec's commit-message contract, not an implementation detail. No regex on bare file body for trigger/permission/concurrency contract fields.

Quoted as evidence (line 116):
```
expect(cron).toMatch(/^\*\/[12]\s+\*\s+\*\s+\*\s+\*$/);
```
This is parsed from `on.schedule[0].cron`, not a raw-file regex — correct structural shape.

## Verdict summary
PASS. Tests are RED, structurally parsed via `yaml` package (matching slice-5 approach), each slice-6 AC sub-property has a test, no fixtures pre-bake the implementation, behavior-pinned contract assertions. Minor adversarial looseness on completed-slices grep is bounded by a companion structural step-finder. Frozen.
