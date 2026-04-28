# Tester review — 040 (attempt 1)

**Verdict**: PASS

## Rubric

### 1. Acceptance criterion coverage
YES

Slice-1 ACs in scope (AC1–5, AC10):

  - AC1 (`{frozen,total}` for kind:code with per-task gates) → tests "kind:code, 3 tasks, 0 frozen", "2 frozen", "all 3 frozen" ✓
  - AC2 (null when kind !== "code") → test "kind:rule → null" ✓
  - AC3 (null when kind:code but no per-task gates) → test "kind:code, 0 tasks with gate fields → null" ✓
  - AC4 (`frozen` counts `.gate-frozen-<N>` files) → "2 frozen" places `.gate-frozen-1` + `.gate-frozen-2`, asserts frozen=2; "all 3" likewise ✓
  - AC5 (`total` = number of slices in tasks.md) → all three positive cases assert total=3 against a 3-task fixture ✓
  - AC10 (cases for non-code, code+no-gates, 0/N, K/N, N/N) → all five branches present ✓

Slice-2 ACs (AC6–9, AC11) intentionally out of scope per dispatch brief.

### 2. Adversarial gap
YES

Concrete attacks that would pass these tests while violating intent:

  (a) An implementation could `readdir(specDir)` and count any file matching
  `/^\.gate-frozen-\d+$/`, ignoring `taskGates()` entirely. Tests would still pass
  because the fixture writes exactly `.gate-frozen-<ordinal>` for ordinals
  ≤ taskCount. AC4's "counts only slices where `.gate-frozen-<N>` exists" is
  satisfied either way, but the spirit ("counts only slices declared in
  tasks.md") is not pinned — there is no test where a stray `.gate-frozen-9`
  exists with no corresponding task #9.

  (b) An implementation could compute `total` as "number of `gate:` lines in
  tasks.md" without going through `taskGates()`; constraint says "Reuses
  `taskGates(specDir)` from spec 039; no duplicated parsing", but no test
  observes the reuse (it's an implementation detail, not behavior).

  (c) The "kind:code, 0 tasks → null" case uses 0 tasks (empty tasks.md after
  header). An impl that returns null whenever `total === 0` would pass, even if
  it never inspects whether `gate:` fields are present. AC3's spirit ("tasks.md
  has no per-task `gate:` fields") is technically equivalent here because
  `taskGates([])` is empty either way, so this is more cosmetic than
  structural.

Gap (a) is the strongest. It's a real adversarial path but minor — counting
`.gate-frozen-N` files directly still produces correct output for any
well-formed spec folder, and `taskGates()` is exercised independently in spec
039's tests. Not blocking.

### 3. Coverage gap
NO

All testable properties for slice 1 are covered:
  - returns shape `{frozen, total}` — covered
  - null short-circuit on non-code kind — covered
  - null short-circuit on no per-task gates — covered
  - frozen count correctness at 0, partial, full — covered
  - total = task count — covered (implicitly, via `total: 3` against 3-task fixture)

The "stray `.gate-frozen-N` for ordinal > taskCount" scenario is a hardening
case, not a stated AC. AC4 says "frozen counts only slices where `.gate-frozen-<N>`
file exists" — no requirement that frozen be clamped to total. Out of scope.

### 4. Behavior vs implementation detail
YES

Tests are behavior-pinned. They:
  - construct fixtures via `mkdtempSync` (no hardcoded paths)
  - call `sliceProgress({ specDir: dir })` and assert on the returned shape
  - never inspect internal function calls, no spies, no module-internal hooks
  - use `toBeNull()` and `toEqual({frozen, total})` — observable return values only

The fixture builder writes real `proposal.md` + `tasks.md` + `.gate-frozen-N`
files, so any implementation strategy (readdir+regex, glob, taskGates+exists)
would satisfy the same observable contract.

## Verdict summary

PASS. All five slice-1 acceptance criteria map to at least one test, all
branches required by AC10 are present, tests are behavior-pinned, and the
adversarial gaps identified are minor (file-count vs taskGates-driven
counting produce identical outputs for well-formed fixtures, and the
constraint about reusing `taskGates()` is implementation hygiene rather than
observable behavior). Cleared to dispatch slice-implementer.
