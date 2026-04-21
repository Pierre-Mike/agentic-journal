# Tester review — 029-hot-file-saturation (attempt 1)

**Verdict**: FAIL

## Rubric

### 1. Acceptance criterion coverage
YES

Mapping:
  - AC 1 (12 Writes → count 12, first_ts, last_ts, session_id, file) → test `12 Write events on one file → one finding with count 12` ✓
  - AC 2 (9 Edits → zero, default threshold 10) → test `9 Edit events on one file → zero findings (below threshold)` ✓
  - AC 3 (6+6 across sessions → zero, per-session grouping) → test `6 Edits on same file in two sessions → zero findings (per-session grouping)` ✓
  - AC 4 (two files ≥10 ordered count desc, first_ts asc) → test `two hot files → ordered by count desc then first_ts asc` ✓ (partial — see item 3)
  - AC 5 (Read/Bash do not count) → test `Read and Bash events do not count toward hot-file total` ✓
  - AC 6 (`renderHotFiles([])` → `""`) → test `empty findings → empty string (no header)` ✓
  - AC 7 (non-empty → starts `"Hot files:\n"` + one `  [<sid>] <file> ×<count>` line per finding) → tests `one finding → starts with 'Hot files:\n'` and `two findings → two lines after header` ✓
  - AC 8 (`aggregate(...).hot_files` populated) → test `aggregate result has hot_files array populated from events` ✓
  - AC 9 (`renderText` includes/omits `Hot files:` header) → tests `renderText includes 'Hot files:' header when hot_files non-empty` and `renderText omits 'Hot files:' when hot_files is empty` ✓

### 2. Adversarial gap
YES

A naive implementation that sorts findings **only by `count` desc** (ignoring the `first_ts asc` and `session_id asc` tiebreaks specified in the Constraints block) would pass every current assertion. The "two hot files" ordering test uses counts 15 vs 10, which is already separable on `count` alone. No test forces the implementer to implement the secondary or tertiary sort keys. An attacker could ship `findings.sort((a,b) => b.count - a.count)` and be green.

Also: the "two hot files" test asserts only `file` and `count` on the resulting findings — it does not assert that `first_ts`, `last_ts`, or `session_id` are correctly populated on findings beyond the first (AC 1 covers only the single-finding case).

### 3. Coverage gap
YES

Uncovered testable properties from proposal.md:

1. **Tiebreak ordering on equal count** — Constraints line 24: `Output order: count desc, then first_ts asc, then session_id asc (stable tiebreaks)`. Neither the `first_ts asc` nor the `session_id asc` tiebreak is exercised by any assertion. Both are deterministic and observable given crafted inputs (two findings with identical `count`, differing `first_ts`; or two findings with identical `count` + `first_ts`, differing `session_id`).

2. **Null/undefined `file` skip** — Constraints line 22: `Skip events where file is undefined or null`. No test feeds Write/Edit events with `file: null` or `file: undefined` to confirm they are skipped rather than counted, grouped under a `null` key, or made to throw. This is directly observable — inject 12 events on a valid file plus 5 events with `file: null` and assert the finding count stays at 12 (not 17) and no `null`-keyed finding appears.

### 4. Behavior vs implementation detail
YES

Tests pin observable contract: exported symbols (`detectHotFiles`, `renderHotFiles`, `HotFileFinding`), return shape (`session_id`, `file`, `count`, `first_ts`, `last_ts`), and render format via regex `/^\s+\[S1\] src\/a\.ts ×15$/` which matches the Constraint's `  [<sid>] <file> ×<count>` spec. Render header pinned by `expect(lines[0]).toBe("Hot files:")`. No implementation-internal coupling observed.

## Verdict summary

FAIL on rubric items 2 and 3. The AC mapping is complete and tests are behavior-pinned, but two Constraint-level properties are untested and an implementer can satisfy all current assertions with a partial sort and no null-file handling. The spec-tester must add: (a) at least one assertion that forces the `first_ts asc` tiebreak when counts are equal, (b) at least one assertion that forces the `session_id asc` tiebreak when both count and first_ts are equal, and (c) at least one assertion that events with `file: null` (and/or `file: undefined`) are skipped rather than counted. Once those gaps close, the gate is sound.
