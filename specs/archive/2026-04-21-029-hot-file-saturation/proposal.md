---
id: 029-hot-file-saturation
title: Hot-file edit saturation detector
status: archived
kind: code
gate: scripts/trace-scan.test.ts
created: 2026-04-21T00:00:00.000Z
owner: main
depends_on:
  - 011-trace-shape-v2
  - 028
supersedes: null
archived: '2026-04-21'
---

## Intent

Add a `detectHotFiles` pure detector to `scripts/trace-scan.ts` that surfaces per-session edit saturation: when a single session accumulates ≥ 10 Write or Edit events on the same file, it is a hot-file finding. This complements `detectLoops` (a burst / rolling-window detector) with a total-volume view that the rolling-window approach misses. The retro identified `tdd-importance.mdx ×24` and `gap-registry.md ×20` as examples of this pattern. Findings are rendered under a `Hot files:` section in `renderText()` and stored in a new `hot_files` field on `TraceScanReport`.

## Constraints

- Signature: `detectHotFiles(params: { events: readonly TraceLine[]; minEdits?: number }): HotFileFinding[]`. Default `minEdits = 10`.
- `HotFileFinding = { session_id: string; file: string; count: number; first_ts: string; last_ts: string }`.
- Count only events where `tool === "Write" || tool === "Edit"`. Non-write-non-edit tools (Read, Bash, etc.) do not count.
- Skip events where `file` is `undefined` or `null`.
- Grouping key: `(session_id, file)` — per-session only. A file that crosses the threshold in one session but not another produces no finding for the under-threshold session.
- Output order: `count` desc, then `first_ts` asc, then `session_id` asc (stable tiebreaks).
- `renderHotFiles(findings: HotFileFinding[]): string` — empty findings → `""` (no header). Non-empty → `Hot files:\n` followed by `  [<sid>] <file> ×<count>` per finding.
- Wire `hot_files: HotFileFinding[]` into `TraceScanReport` and populate via `detectHotFiles({ events, minEdits: 10 })` in `aggregate()`.
- Wire `renderHotFiles` into `renderText()` alongside the existing `Loops:` / `Blocks:` sections.
- No hook-enforced ceiling — that is deferred until 028's ToolBlocked data accumulates.
- No CI metric export, no historical backfill.

## Acceptance criteria

- [ ] Single session with 12 Write events on one file → one finding, `count === 12`, correct `first_ts`, `last_ts`, `session_id`, `file`.
- [ ] Single session with 9 Edit events on one file → zero findings (default threshold = 10).
- [ ] 6 Edits on file A in session S1 and 6 Edits on file A in session S2 → zero findings (per-session grouping).
- [ ] Two files each at ≥ 10 edits in same session → findings ordered count desc, then first_ts asc.
- [ ] Non-Write-non-Edit tools (Read, Bash) do not count toward the total.
- [ ] `renderHotFiles([])` returns `""`.
- [ ] `renderHotFiles(findings)` with ≥ 1 finding starts with `"Hot files:\n"` and contains one `  [<sid>] <file> ×<count>` line per finding.
- [ ] `aggregate(...)` result has a `hot_files` field that is a populated `HotFileFinding[]`.
- [ ] `renderText(report)` includes `Hot files:` when `report.hot_files.length > 0` and omits it when `report.hot_files` is empty.

## Context

- Spec 011 (`011-trace-shape-v2`): shipped `detectLoops`, `detectDrift`, `detectRetryStorm`, and the canonical `TraceLine` schema.
- Spec 028 (`028-hook-block-observability`): added `parseBlocked`, `renderBlocks`, `BlockFinding`, and the `blocks` field on `TraceScanReport` — the structural pattern this spec mirrors.
- Retro origin: post-session review identified `tdd-importance.mdx ×24` and `gap-registry.md ×20` as anomalous revision cycles invisible to the rolling-window burst detector.
