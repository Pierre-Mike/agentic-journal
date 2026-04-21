# Tasks

Ordered. Gate files `scripts/trace-scan.test.ts` and `.claude/hooks/enforce.test.ts` are frozen by the judge and MUST NOT appear in any task's `file_targets`.

- [x] 1. Upgrade `block()` signature in `.claude/hooks/types.ts` to `block(event: ToolEvent, reason: string, filePath: string)`; call `emitBlocked(...)` before throwing `BlockError`.
  - agent: main
  - depends: []
  - file_targets: [.claude/hooks/types.ts]
  - boundary: [.claude/hooks/types.ts]
- [x] 2. Add `emitBlocked(event, reason, tool, filePath)` export in `.claude/hooks/observe.ts` — appends a `ToolBlocked` line with `status: "blocked"`; never throws; mirrors `emitTrace()` structure.
  - agent: main
  - depends: [1]
  - file_targets: [.claude/hooks/observe.ts]
  - boundary: [.claude/hooks/observe.ts]
- [x] 3. Update every `block(...)` call site in `.claude/hooks/enforce.ts` to pass `(event, reason, filePath)`. The gate file `.claude/hooks/enforce.test.ts` (spec 028 describe blocks) is frozen — do NOT edit it; the call-site change plus tasks 1-2 must satisfy the frozen assertions.
  - agent: main
  - depends: [1, 2]
  - file_targets: [.claude/hooks/enforce.ts]
  - boundary: [.claude/hooks/enforce.ts]
- [x] 4. Add `parseBlocked()` + `renderBlocks()` in `scripts/trace-scan.ts`; widen `TraceLine` with optional `reason`; extend `TraceScanReport` with `blocks: BlockFinding[]`; populate via `aggregate()`; surface in `renderText()` as a `Blocks:` section emitted only when non-empty.
  - agent: main
  - depends: [1, 2, 3]
  - file_targets: [scripts/trace-scan.ts]
  - boundary: [scripts/trace-scan.ts]
- [x] 5. Write retro findings — retrospective audit trail for the 2026-04-20 `/retro` cycle that spawned this spec.
  - agent: main
  - depends: []
  - file_targets: [specs/active/028-hook-block-observability/findings.md]
  - boundary: [specs/active/028-hook-block-observability/findings.md]
- [x] 6. Verify — `bun run tasks:verify` green end-to-end; fix orphan-check in `tasks-verify.ts` to exclude gate paths from the union boundary.
  - agent: main
  - depends: [1, 2, 3, 4, 5]
  - file_targets: [scripts/trace-scan.ts, scripts/tasks-verify.ts]
  - boundary: [scripts/trace-scan.ts, .claude/hooks/**, scripts/tasks-verify.ts]
