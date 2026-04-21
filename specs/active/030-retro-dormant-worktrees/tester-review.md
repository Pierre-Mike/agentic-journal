# Tester review — 030-retro-dormant-worktrees (attempt 1)

**Verdict**: FAIL

## Rubric

### 1. Acceptance criterion coverage
YES (all ACs have at least one assertion), with one caveat under item 2.

Mapping:
  - AC1 (script + `detectDormantWorktrees` export) → test 1 (import + typeof function check) ✓
  - AC2 (returns only dormant-qualified entries) → test 1 (exactly-1, is `old-no-pr`) ✓
  - AC3 (open PR not flagged) → test 1 (fixture b excluded via count=1) ✓
  - AC4 (merged PR not flagged) → test 1 (fixture c excluded via count=1) ✓ (see item 2 — the `--state all` pathway is not exercised)
  - AC5 (non-spec branch not flagged) → test 1 (fixture d excluded) ✓
  - AC6 (<1h commit not flagged) → test 1 (fixture e excluded) ✓
  - AC7 (text header / empty string) → test 2 ✓
  - AC8 (`--json` array of DormantSpec) → test 3 ✓
  - AC9 (SKILL.md amended with invocation) → test 4 ✓
  - AC10 (smoke exits 0 post-impl) → `main()` exit logic ✓

### 2. Adversarial gap
YES — multiple concrete gaps.

a. **Fixture-stub bypass**: the gate drives behaviour exclusively through `GIT_WORKTREE_LIST_FIXTURE`, `GH_PR_LIST_FIXTURE`, `GIT_LOG_FIXTURE` env vars. An implementer can ship a `retro-preflight.ts` whose `detectDormantWorktrees()` body is essentially `if (env.GIT_WORKTREE_LIST_FIXTURE) { ...parse fixtures and return filtered list... } else { return []; }`. No assertion exercises the real subprocess path (`git worktree list --porcelain`, `gh pr list ...`, `git log -1`). Production running with empty env vars would always return `[]`, yet the smoke is all-green.

b. **`--state all` flag not verified**: Constraints line 29 mandate `--state all` (so merged PRs count). The fixture for `spec/merged-pr` is a pre-cooked `[{ number: 17 }]` array that makes the merged-PR case indistinguishable from the open-PR case; nothing asserts the CLI invocation string contains `--state all`. An implementer who calls `gh pr list --head <branch> --json number` (default `--state open`) passes the smoke but ships broken: in production, merged PRs return `[]`, so every post-merge worktree parked pre-cleanup would be flagged as dormant (or inversely, depending on intent).

c. **Path-prefix filter not exercised**: every fixture worktree sits under `.agentic/worktrees/<slug>`. Nothing feeds a worktree path outside that prefix to confirm it is excluded. An implementer could drop the path check entirely and still pass.

### 3. Coverage gap
YES.

- **`--state all` on the `gh pr list` call** (Constraints line 29): no test asserts the flag is present in the actual invocation or the fixture key schema.
- **Path-prefix constraint** (`.agentic/worktrees/`, Constraints line 23 item 1): no negative fixture tests that a non-`.agentic/worktrees/` worktree is excluded.
- **Real-subprocess smoke**: no assertion (even a lightweight one — e.g., running with no fixture env and checking exit code 0 plus empty JSON array in a clean tmp repo) forces the implementation to have a real code path beyond fixture lookup.
- **`age_days` precision boundary** (Constraints line 30, "1 hour, not 1 day"): the `age_days` field name suggests days, but the threshold is 1 hour. Nothing asserts that `age_days` for a 2h-old commit is a fractional value around `0.083`. An implementer could floor to integer days and return `0` for everything <24h, inverting the freshness semantics; the current test only checks `age_days >= 0`.

### 4. Behavior vs implementation detail
NO — tests leak implementation shape.

- Test 2 requires a named export `renderDormant`:

    ```ts
    if (typeof mod.renderDormant !== "function") {
        fail("renderDormant export", "not a function or missing — needed for text output test");
        return;
    }
    ```

  `renderDormant` is not mentioned in `proposal.md` constraints or ACs — only the CLI default output contract is specified. Pinning the module's internal function name is implementation detail, not observable behaviour. The text-output AC is observable via the CLI (the same pathway used in test 3 for `--json`), so the assertion should drive the CLI, not a private export.

- The three fixture env-var names (`GIT_WORKTREE_LIST_FIXTURE`, `GH_PR_LIST_FIXTURE`, `GIT_LOG_FIXTURE`) are a test-imposed contract absent from `proposal.md`. They lock the implementation into a specific test-hook shape (and, per item 2a, enable the fixture-stub bypass). The observable behaviour the spec describes is subprocess invocation of `git worktree list` and `gh pr list`; the gate should either assert that subprocess behaviour (e.g., via PATH-shimmed stubs) or declare the env-var protocol in `proposal.md` as a first-class contract so it isn't invisible coupling.

## Verdict summary

FAIL. Item 1 is clean; items 2, 3, and 4 each have structural issues that compound: the gate's fixture-env protocol simultaneously (a) lets an implementer pass with a stub that hardcodes the fixture branches, (b) hides the `--state all` requirement from assertion, and (c) couples the spec to an undeclared test-hook shape. Revision should:

1. Make the `--state all` requirement observable — either assert on the actual `gh` invocation (PATH-shimmed stub that records argv) or add a fixture scenario that would only behave correctly with `--state all` (e.g., keying the fixture on `<branch>+<state-flag>` and asserting the merged case is retrieved under `state=all`).
2. Add a negative path-prefix fixture: a worktree outside `.agentic/worktrees/` on a `spec/*` branch, old, no PR — asserted excluded.
3. Either (a) promote the env-var fixture protocol to `proposal.md` as a declared test-affordance constraint and keep the current shape, or (b) replace env-var injection with PATH-shimmed stub binaries so the smoke exercises the real subprocess pathway.
4. Drop the `renderDormant` named-export assertion; test the CLI default text output via the same subprocess harness used for `--json`.
5. Tighten the `age_days` assertion to pin the hour-granularity semantics (so flooring to integer days fails).

Do not propose specific test code — the above names the gaps; shape is the spec-tester's call.
