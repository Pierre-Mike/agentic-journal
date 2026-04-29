# Tester review — 049 slice 5 (attempt 2 of 3)

**Verdict**: PASS

## Rubric

### Item 0: RED proven
YES. `red-proof-5.txt` shows `exit_code: 1`, `0 pass / 31 fail`, all failures stem from "bootstrap.yml not found at .github/workflows/bootstrap.yml". Genuine RED — every assertion would fail without an implementation file.

### Item 1: Acceptance criterion coverage
YES. Mapping (AC #1 from `proposal.md` decomposed):

- AC1.a "triggers on issues.opened|edited" → `trigger events (structural) > on.issues.types contains 'opened' / 'edited'` ✓ (now structural via parseYaml on `on.issues.types`)
- AC1.b "triggers on issue_comment.created" → `on.issue_comment exists / on.issue_comment.types contains 'created'` ✓
- AC1.c "no label filter" → `on.issues.types does NOT contain 'labeled'` ✓
- AC1.d "creates branch auto/<issue#>-<slug>" → `branch creation > 'auto/' prefix / issue.number / slug from issue.title (or output) / git checkout -b|switch -c` ✓ (slug now covered via title-transform OR slug-id output OR consumed steps.*.outputs.* reference)
- AC1.e "opens draft PR" → `draft PR creation > gh pr create --draft` ✓
- AC1.f "PR linked to issue" → `PR is linked to the issue` ✓
- AC1.g "invokes /do-auto" → `claude /do-auto invocation > claude -p / /do-auto / ANTHROPIC_API_KEY / threads issue.body` ✓
- AC1.h "commits alignment.md only on confidence:high" → `confidence gate (structural) > commit step has if: guard referencing confidence/high/outputs` ✓ (now structural)
- Low-path (alignment.md spec) → `issue-comment step has if: guard referencing confidence/low/outputs` ✓
- High/low mutual exclusivity → `high-path and low-path if: guards are mutually exclusive` ✓
- Operational invariants (permissions, concurrency keyed on issue.number, cancel-in-progress, runs-on, checkout@v4 fetch-depth:0) → corresponding structural blocks ✓

### Item 2: Adversarial gap
Searched. All four blockers from attempt 1 closed:

1. Confidence gate now structural — `commitStep.if` must be defined AND lowercase-match `confidence|high|outputs.`; same for the comment step against `confidence|low|outputs.`. An unconditionally-committing implementation fails because `commitStep?.if` is undefined.
2. Trigger types now parsed structurally via `yaml.parse` and asserted as array membership of `on.issues.types` / `on.issue_comment.types`. A label-only workflow with the word "opened" in a step name no longer passes.
3. Issue-comment collusion (always-comment + always-commit) blocked by per-step `if:` requirement plus mutual-exclusivity assertion.
4. Slug coverage added — branch construction must transform `issue.title` (lower/sed/tr/replace/slugify/gsub/toLower/toLowerCase), or expose a slug-id step output, or consume `steps.*.outputs.*` in an `auto/` run.

Residual minor concern: the `mutuallyExclusive` boolean at lines 366-373 becomes true if either `if:` contains a `!`, which a defensive `if: "!failure()"` could spuriously satisfy. However, the per-step assertions at 303-335 already require each `if:` to reference confidence/high/low/outputs tokens, so the combined gate still requires both guards to be confidence-derived. Bounded gap, acceptable.

### Item 3: Coverage gap
None. The three uncovered properties named in attempt 1 (commit `if:` guard, slug derivation, mutual exclusivity) all have explicit structural tests now.

### Item 4: Behavior vs implementation detail
YES. Tests assert YAML surface contract (trigger keys/types, permissions block, concurrency group, step `if:` clauses, runner label, action ref) — observable behavior at the workflow layer. `actions/checkout@v4` and `ubuntu-latest` version pinning is conventional for workflow gates and was accepted in attempt 1.

## Verdict summary

PASS on attempt 2. Tester migrated from word-grep to structural `yaml.parse` assertions, added the missing `if:`-on-commit-step guard, mutual-exclusivity check, and slug-derivation coverage. All four attempt-1 blockers closed without introducing new structural gaps. RED is genuine. Ready for spec-implementer dispatch.
