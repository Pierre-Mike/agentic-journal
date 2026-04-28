# Tester review — 040 slice 2 (attempt 1)

**Verdict**: PASS

## Rubric

### 1. Acceptance criterion coverage
YES

Slice 2 ACs (formatSpecLine):
- AC "`formatSpecLine(spec, archived, sliceProgress)` exported from `scripts/spec-status.ts` returns the line as a string" → test `formatSpecLine export › is a function` + every other test which asserts a string return value via `toBe(...)` ✓
- AC "When `sliceProgress` arg is `null`, output is byte-identical to pre-040 format" → tests `null sliceProgress (non-slice-RED) › READY spec with null progress — no tag appended`, `BLOCKED spec with null progress — no tag appended`, `no trailing space or extra characters`, plus `BLOCKED-BY comma list › lists multiple unresolved deps comma-separated` ✓
- AC "When `sliceProgress` arg is `{ frozen, total }`, output has ` [N/M frozen]` appended after `(<kind>)`" → tests `non-null sliceProgress › READY spec — tag appended at end`, `READY spec with 0 frozen`, `READY spec with all slices frozen`, `tag format is single-space-prefixed [K/N frozen]` ✓
- AC "works for both READY and BLOCKED-BY states" (implicit from "appended after `(<kind>)`" combined with bullet on null parity) → tests `BLOCKED spec — tag still appended` and `BLOCKED-BY with sliceProgress tag` ✓
- AC "`scripts/spec-status.test.ts` exists and tests `formatSpecLine` output for both null and non-null sliceProgress arg" → file exists, both branches covered ✓

Slice 1 ACs (sliceProgress helper) and `main()` wiring AC are explicitly out of scope for this gate per dispatch instructions.

### 2. Adversarial gap
NO — searched, found none of structural concern.

Considered: an implementation that always appends ` [N/M frozen]` only when the third arg is non-null (no real branching on intent) would satisfy these tests without being faithful to the intent — but the intent IS exactly "branch on null vs non-null", so this is not a gap. Considered: a `formatSpecLine` that hardcodes "READY"/"BLOCKED-BY: 039" patterns from spec id heuristics — ruled out because tests vary id, kind, archived set, and dep list across cases (`041/rule`, `042/writeup/[039]`, `043/workflow`, `045/code/[035,039,040]` with empty archived, `040/code/[035,039]` with `035` archived → BLOCKED-BY: 039 only). The matrix forces real dep-resolution logic. Considered: implementation that ignores `archived` set — ruled out by the BLOCKED test where `035` is archived and only `039` appears in the BLOCKED-BY list. No structural attacker path remains.

### 3. Coverage gap
NO

Tested properties: function-ness of export, null-arg byte parity for READY/BLOCKED, non-null tag append for READY/BLOCKED, 0/N and N/N edges, single-space prefix on tag, no trailing space, multi-blocker comma-list formatting, archived-set filtering of dep list. The slice 2 testable surface area for a pure formatter is fully exercised.

### 4. Behavior vs implementation detail
YES — tests behavior-pinned.

All assertions are full-string `toBe(...)` comparisons against the externally observable line, plus one `endsWith` check. No internal helper names, no file paths, no library error strings. The only structural coupling is `import type { Spec } from "./_lib"`, which is necessary to construct the input fixture and is the documented public contract from spec 035.

## Verdict summary

PASS. Every slice-2 acceptance criterion maps to at least one assertion. The READY/BLOCKED × null/non-null matrix is fully covered, including 0/N, K/N, N/N edges, multi-blocker dep lists, and archived-set filtering. Tests are pinned to the exact output string an operator sees. No adversarial gap survives the input matrix. No coverage gap on slice-2's testable surface. Sentinel `.gate-frozen-2` will be created.
