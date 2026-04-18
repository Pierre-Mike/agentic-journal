# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.
Parallel-safe siblings are marked `[P]`.

- [x] 1. Extend `.claude/hooks/enforce.test.ts` with RED assertions covering malformed JSON, blocked event, internal error, and a "never exit 1" guardrail
  - agent: main
  - depends: []
  - file_targets: [.claude/hooks/enforce.test.ts]
- [x] 2. Wrap `enforcePreToolUse` body in try/catch that exits 2 on any throw in `.claude/hooks/enforce.ts`
  - agent: main
  - depends: [1]
  - file_targets: [.claude/hooks/enforce.ts]
- [x] 3. Wrap dispatcher JSON parse + event routing in try/catch → exit 2, and register process-level fail-closed listeners in `.claude/hooks.ts`
  - agent: main
  - depends: [1]
  - file_targets: [.claude/hooks.ts]
- [x] 4. Run `bun run check` and ensure it passes
  - agent: main
  - depends: [2, 3]
  - file_targets: [.claude/hooks/enforce.ts, .claude/hooks.ts, .claude/hooks/enforce.test.ts]

Task box ticking happens via `scripts/spec-complete.ts`, not manually.
