# Tester review — 028 (attempt 2 of 3)

**Verdict**: PASS

## Rubric

### 1. Acceptance criterion coverage
YES

Mapping (AC numbering from `proposal.md` Acceptance criteria bullets):

- AC 1 (`types.ts`: `block()` signature upgraded, calls `emitBlocked` before throwing) → `.claude/hooks/enforce.test.ts` → `block() emit-before-throw — spec 028 > block() calls emitBlocked before throwing BlockError` ✓ (imports `block` from `./types`, invokes with `(event, reason, filePath)`, asserts `.jsonl` contains `ToolBlocked` line even though `block()` threw)
- AC 2 (`observe.ts`: exports `emitBlocked(...)`, appends `ToolBlocked` with `status:"blocked"`, never throws) → `emitBlocked — spec 028 > appends a ToolBlocked line...` + `> never throws when given malformed/missing input` ✓
- AC 3 (`enforce.ts`: every `block(...)` call site passes `(event, reason, filePath)`) → `enforce.ts call-site integration — spec 028 > a blocked PreToolUse emits a ToolBlocked line whose reason and file match the rule that fired` ✓ (spawns real dispatcher, blocks on `wrangler.toml`, reads back `.jsonl` from temp-dir traces, asserts `reason` + `file` populated)
- AC 4 (`trace-scan.ts`: `parseBlocked`, `renderBlocks`, `aggregate.blocks`, `renderText` `Blocks:` header) → `scripts/trace-scan.test.ts` → `parseBlocked — spec 028`, `renderBlocks — spec 028`, `aggregate.blocks + renderText \`Blocks:\` section — spec 028` ✓
- AC 5 (zero blocks → no header) → `aggregate.blocks + renderText > zero blocks → no \`Blocks:\` header in renderText output` ✓
- AC 6 (format `[<sid>] <reason> → <file> ×<count>`; empty input → no header) → `renderBlocks — spec 028 > renders each finding as...` + `> empty findings → empty string (no header)` ✓
- AC 7 (`bun run tasks:verify` green) → meta, out-of-gate ✓

Constraint coverage (proposal.md Constraints section) also checked:
- Single-writer rule (`enforce.ts` never touches file) → `emitBlocked — spec 028 > observe.ts is the single writer — enforce.ts does not import fs write functions directly` ✓
- `emitBlocked` never-throw → ✓
- `block()` emit-THEN-throw → ✓
- `reason` passed through verbatim → exact-string equality on readback ✓
- Scanner grouping `(session_id, reason, file)` + order (count desc, first-seen asc) → ✓

### 2. Adversarial gap
NO — searched, found none material.

Best attempted gap: Constraint §4 ("no `parent_span_id`, no `duration_ms`" — point event, not span) is not asserted as a negative. An implementer could emit a `ToolBlocked` line that also carries span fields without breaking any current assertion. This is the letter of a shape constraint, not the observability spirit (`/retro` still consumes correctly). Mild, not structural.

The attempt-1 adversarial path (stub `emitBlocked`, leave hooks silent) is closed: three independent hook-seam tests (never-throw, emit-before-throw, dispatcher integration) all read `.jsonl` back from a temp-dir and demand the `ToolBlocked` line land on disk through the real code path. A no-op stub fails every one.

### 3. Coverage gap
YES (minor).

- Negative-shape assertion on trace line: no test pins that `ToolBlocked` omits `parent_span_id` / `duration_ms`. Testable as `expect(blocked?.parent_span_id).toBeUndefined()` against the same readback fixture. Classified minor because downstream scanner doesn't read those fields, so the omission doesn't compromise the observability intent.

No structural gaps remain. The three hook-side ACs that attempt 1 flagged are now each anchored to at least one observable temp-dir `.jsonl` readback.

### 4. Behavior vs implementation detail
YES — tests are behavior-pinned, with one acceptable source-level concession.

Concession: the single-writer test reads `enforce.ts` source and greps for literal fs function names:

```
expect(enforceSrc).not.toMatch(/appendFileSync/);
expect(enforceSrc).not.toMatch(/writeFileSync/);
expect(enforceSrc).not.toMatch(/openSync/);
expect(enforceSrc).not.toMatch(/createWriteStream/);
```

This is a static-source assertion, not a runtime-behavior assertion. It's the most direct way to pin the "enforce.ts never touches `.jsonl` directly" constraint without an import-graph crawler. The allow-list is reasonable (covers the node:fs write surface). Accept as minor coupling cost for a real structural invariant; not a blocker.

All other assertions use public exports (`block`, `emitBlocked`, `parseBlocked`, `renderBlocks`, `aggregate`, `renderText`), the real dispatcher as a spawned process, and `.jsonl` readback — all observable contract.

## Verdict summary

PASS on attempt 2. The gate widening from attempt 1 landed correctly: ACs 1/2/3 are now anchored to temp-dir `.jsonl` readback assertions driven through the real `block()`, the real `emitBlocked()`, and the real dispatcher process. The attempt-1 adversarial path (stub `emitBlocked`, leave hooks silent, let scanner pass on fixtures) is closed. Remaining concerns are minor: one unpinned negative-shape constraint (no `parent_span_id`/`duration_ms`), and one source-grep concession for the single-writer invariant. Neither is structural. Freeze gate and proceed to GREEN.
