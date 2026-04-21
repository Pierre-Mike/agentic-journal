# Tester review — 028 (attempt 1 of 3)

**Verdict**: FAIL

## Rubric

### 1. Acceptance criterion coverage
NO

AC numbering (sequenced from proposal.md `- [ ]` bullets):

- AC 1 (`types.ts`: `block()` signature upgraded; calls `emitBlocked(...)` before throwing) → **UNCOVERED**
- AC 2 (`observe.ts`: exports `emitBlocked(...)` appending `ToolBlocked` line with `status: "blocked"`; never throws) → **UNCOVERED**
- AC 3 (`enforce.ts`: every `block(...)` call site passes `(event, reason, filePath)`) → **UNCOVERED**
- AC 4 (`trace-scan.ts`: `parseBlocked`, `renderBlocks`, `aggregate.blocks`, `renderText` Blocks: header) → `parseBlocked — spec 028`, `renderBlocks — spec 028`, `aggregate.blocks + renderText \`Blocks:\` section — spec 028` ✓
- AC 5 (zero blocks → no header) → `renderBlocks — spec 028 > empty findings → empty string`, `aggregate.blocks + renderText > zero blocks → no Blocks: header` ✓
- AC 6 (test cases assert `[<sid>] <reason> → <file> ×<count>` format and empty-input no-header) → `renderBlocks — spec 028 > renders each finding as...`, `renderBlocks — spec 028 > empty findings → empty string` ✓
- AC 7 (`bun run tasks:verify` green) → meta, not a unit test; acceptable as out-of-gate.

ACs 1, 2, 3 are hook-side behavior. The declared gate `scripts/trace-scan.test.ts` only consumes synthetic `TraceLine[]` fixtures — it never exercises `.claude/hooks/types.ts::block()`, never exercises `.claude/hooks/observe.ts::emitBlocked()`, never exercises any `enforce.ts` call site. The hook-to-scanner data path is asserted in zero places.

### 2. Adversarial gap
YES

Concrete adversarial path: an implementer can leave `.claude/hooks/enforce.ts` unchanged (or change it incorrectly), add a stub `emitBlocked` export that is a no-op (or writes to stdout instead of `.jsonl`), and wire `block()` in `types.ts` to *not* call `emitBlocked`. Since the gate fixtures are hand-constructed `TraceLine` objects passed directly to `parseBlocked` / `aggregate`, no test forces the hook side to actually produce any `ToolBlocked` line on disk. The scanner tests pass; the feature (make real hook-enforced friction visible) does not work end-to-end. This violates the intent declared in the Intent paragraph of `proposal.md` ("wires the missing signal").

A second, weaker gap: the "never throws" contract on `emitBlocked` (Constraints §2, AC 2) is not exercised. An implementation that throws on a malformed event would regress the fail-open invariant from spec 008 silently.

### 3. Coverage gap
YES

Uncovered testable properties:

- `block()` in `types.ts` invokes `emitBlocked(...)` on the blocked-exit path before throwing `BlockError`. (observable via spy/mock or via `.jsonl` file written during test)
- `emitBlocked()` appends a line with `event: "ToolBlocked"` and `status: "blocked"` to `.claude/traces/<session>.jsonl`. (observable via temp-dir `.jsonl` read-back)
- `emitBlocked()` never throws when given malformed input. (observable via `expect(() => emitBlocked(...)).not.toThrow()` with bad args)
- `enforce.ts` passes `(event, reason, filePath)` at every call site — i.e. the integration, given a real blocked PreToolUse, yields a `ToolBlocked` line whose `reason` and `file` match the block rule. (observable via hook-level integration test)
- `observe.ts` is the single writer — `enforce.ts` does not touch the file. (observable via import-graph or spy on fs writer)

All five are deterministic assertions given mockable inputs and observable outputs. None is covered by the current gate.

### 4. Behavior vs implementation detail
YES (behavior-pinned, within the narrow scanner scope)

Inside the gate file, the spec-028 assertions are pinned to observable contract surface: exported function names (`parseBlocked`, `renderBlocks`) that AC 4 mandates, the rendered format tokens (`Blocks:`, `×`, `→`) that the Scanner-output-format section of design.md mandates, and structural count/ordering asserts. Reason strings and file paths used in fixtures (e.g. `"wrangler.toml is a protected file."`, `"specs/archive/2026-04-18-008-hook-fail-open/proposal.md"`) are fixture data, not coupled to implementation internals. The `blockedEvent` helper casts `reason` via `as unknown as Partial<TraceLine>` — this is a schema-widening concession, not coupling. No hard-coded absolute paths, no library-specific error strings, no internal function name matching.

Within scope, tests are behavior-pinned. The problem is not coupling — it is scope.

## Verdict summary

FAIL on attempt 1 because rubric item 1 (three unmapped ACs) and item 3 (five uncovered testable properties) fail, with a concrete adversarial gap identified under item 2. The declared gate `scripts/trace-scan.test.ts` is legitimately narrow — it only tests the scanner — but ACs 1, 2, 3 describe hook-side behavior (`block()` signature + call, `emitBlocked()` export + never-throw contract + `.jsonl` write, `enforce.ts` call-site updates) that the scanner gate cannot reach from synthetic fixtures. An implementation can satisfy every scanner assertion while leaving the hooks silent, which directly violates the Intent ("wires the missing signal"). Expected correction, at the rubric level: either (a) widen the gate declaration in `proposal.md` frontmatter to include a second test file covering the hook side (e.g. a colocated test for `observe.ts::emitBlocked` and an integration case for `types.ts::block`), and add assertions there that pin emit-before-throw, never-throw, and `.jsonl` contents; or (b) restate ACs 1–3 in proposal.md as internal refactor notes (not acceptance criteria) and add one scanner-observable acceptance criterion that forces the end-to-end path (e.g. a test that drives the real hook and then asserts via `parseBlocked` on the resulting `.jsonl`). Do not propose the test code — re-author the gate so the unmapped ACs land on observable assertions.
