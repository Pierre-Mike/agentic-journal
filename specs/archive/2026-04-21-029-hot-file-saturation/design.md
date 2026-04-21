# Design — 029 Hot-file edit saturation detector

## Approach

`detectHotFiles` is a pure total-volume detector. It:

1. Iterates all events, filtering to those where `tool === "Write" || tool === "Edit"` and `file` is non-null.
2. Groups by `(session_id, file)` composite key, accumulating count, min `ts` (first_ts), and max `ts` (last_ts).
3. Discards groups whose count is below `minEdits` (default 10).
4. Sorts surviving findings by `count` desc, then `first_ts` asc, then `session_id` asc.

No rolling window, no session-boundary detection — just a straight Map accumulation over the full event set, mirroring the `parseBlocked` pattern from spec 028.

`renderHotFiles` follows the same `renderBlocks` pattern: returns `""` on empty input, otherwise emits `Hot files:\n` + one `  [<sid>] <file> ×<count>` line per finding.

`aggregate()` adds `hot_files: detectHotFiles({ events, minEdits: 10 })` alongside the existing detector calls.

`renderText()` adds a `if (report.hot_files.length > 0)` block that delegates to `renderHotFiles`, placed in the same neighborhood as the `Loops:` / `Blocks:` sections.

## Files touched

- `scripts/trace-scan.ts` — implementation (implementer's file, frozen gate excluded)
- `scripts/trace-scan.test.ts` — frozen gate (spec-tester authored, implementer must not edit)

## Decisions

1. **Default threshold = 10.** Matches the observed retro baseline (≥10 edits per session is anomalous for non-generated files). Exposed as `minEdits` parameter, not hard-coded, so a future rule can tune it.
2. **Per-session, not global.** A globally-edited file (e.g. `proposal.md` across many sessions) would be noise. Session-scoped isolates the within-session revision cycles the retro is targeting.
3. **Saturation ≠ loop.** `detectLoops` is a burst detector (rolling window of 10 events, maxRepeats 3). `detectHotFiles` is a total-count detector (whole session). Both can fire for the same file. They are complementary.
4. **Kind: code, not rule.** Surface the signal first. Hook-enforced ceilings are deferred until 028's ToolBlocked data shows where real thresholds should land.

## Out of scope

- Hook-enforced write ceilings (deferred to a later rule-spec once 028's data exists).
- CI metric export.
- Historical backfill of traces.
- `MultiEdit` / `NotebookEdit` inclusion — kept simple with `Write | Edit` only, matching retro baseline.
