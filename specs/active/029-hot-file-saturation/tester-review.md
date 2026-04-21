# Tester review — 029-hot-file-saturation (attempt 2)

**Verdict**: PASS

## Rubric

### 1. Acceptance criterion coverage
YES
Mapping:
  - AC 1 (12 Writes → count 12, ts fields) → `12 Write events on one file → one finding with count 12` (asserts session_id, file, count, first_ts, last_ts) ✓
  - AC 2 (9 Edits → 0) → `9 Edit events on one file → zero findings (below threshold)` ✓
  - AC 3 (6+6 two sessions → 0) → `6 Edits on same file in two sessions → zero findings (per-session grouping)` ✓
  - AC 4 (two hot files ordered count desc, then first_ts asc) → `two hot files → ordered by count desc then first_ts asc` + `equal counts → ordered by first_ts asc` + `equal counts and equal first_ts → ordered by session_id asc` ✓
  - AC 5 (Read/Bash don't count) → `Read and Bash events do not count toward hot-file total` ✓
  - AC 6 (`renderHotFiles([])` → `""`) → `empty findings → empty string (no header)` ✓
  - AC 7 (header + per-finding line) → `one finding → starts with 'Hot files:\n'` + `two findings → two lines after header` (regex pins `[<sid>] <file> ×<count>` format) ✓
  - AC 8 (`aggregate.hot_files` populated) → `aggregate result has hot_files array populated from events` ✓
  - AC 9 (renderText includes/omits `Hot files:`) → `renderText includes 'Hot files:' header when hot_files non-empty` + `renderText omits 'Hot files:' when hot_files is empty` ✓

### 2. Adversarial gap
NO
Searched. The two gaps flagged in attempt 1 (tiebreak ordering, skip-null-file) are now exercised by dedicated assertions. A stub sort on count alone would now fail the equal-count tiebreak tests. A stub that does not skip undefined-file events would now fail the 12-undefined-writes test and mis-count the mixed 15-event test.

One cosmetic residual: proposal constraint says "skip events where `file` is `undefined` or `null`" but only the `undefined` branch is asserted; an implementation that skips `undefined` but not `null` could pass. This is minor — a reasonable `== null` check or falsy-guard covers both, and the undefined path is the one actually produced by `preEvent`'s typing. Not structural.

### 3. Coverage gap
NO
All testable properties from Intent + Constraints + Acceptance criteria are covered. The `null`-vs-`undefined` split in the skip-file constraint is the only untouched edge; it is a single-line typing variant of an already-covered behavior, not an independent property.

### 4. Behavior vs implementation detail
YES
Tests pin observable outputs: return shape (`findings[0]?.count`, `first_ts`, `session_id`), ordering via array index, rendered text via `toContain` / `startsWith` / regex like `/^\s+\[S1\] src\/a\.ts ×15$/`. No coupling to internal function names, file layout, or library errors.

## Verdict summary
PASS. Attempt 2 closes both coverage gaps called out in attempt 1 (tiebreak ordering and skip-undefined-file) with four targeted assertions. Every acceptance criterion maps to at least one behavior-pinned test. The residual null-vs-undefined cosmetic is not a structural gap.
