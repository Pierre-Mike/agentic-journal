# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`, and `boundary`.

Note: this spec is `kind: workflow`, NOT `kind: code`. Per Decision 1, per-task `gate:` fields are only required for `kind: code` specs. This spec runs under the legacy single-gate path and does not include per-task `gate:` fields — that is the new schema being introduced by this very spec.

- [x] 1. Add taskGates() helper to _lib.ts
  - agent: main
  - depends: []
  - file_targets: [scripts/_lib.ts]
  - boundary: [scripts/_lib.ts]

- [x] 2. Update tasks.md and proposal.md templates with per-task gate field
  - agent: main
  - depends: [1]
  - file_targets: [specs/_template/tasks.md, specs/_template/proposal.md]
  - boundary: [specs/_template/tasks.md, specs/_template/proposal.md]

- [x] 3. Validate per-task gate shape in spec-lint.ts
  - agent: main
  - depends: [1]
  - file_targets: [scripts/spec-lint.ts]
  - boundary: [scripts/spec-lint.ts, scripts/spec-lint.test.ts]

- [x] 4. Make tasks-verify.ts slice-aware
  - agent: main
  - depends: [1]
  - file_targets: [scripts/tasks-verify.ts]
  - boundary: [scripts/tasks-verify.ts]

- [x] 5. spec-complete.ts requires all per-slice sentinels for kind:code
  - agent: main
  - depends: [1]
  - file_targets: [scripts/spec-complete.ts]
  - boundary: [scripts/spec-complete.ts]

- [x] 6. Hook: findSliceForPath + bare .gate-frozen inert
  - agent: main
  - depends: [1]
  - file_targets: [.claude/hooks/enforce.ts]
  - boundary: [.claude/hooks/enforce.ts, .claude/hooks/enforce.test.ts]

- [x] 7. /do SKILL.md: Step 5 scaffold-only + Step 6 per-slice loop
  - agent: main
  - depends: []
  - file_targets: [.claude/skills/do/SKILL.md]
  - boundary: [.claude/skills/do/SKILL.md]

- [x] 8. spec-tester agent doc: scaffold mode vs slice mode
  - agent: main
  - depends: [7]
  - file_targets: [.claude/agents/spec-tester.md]
  - boundary: [.claude/agents/spec-tester.md]

- [x] 9. spec-judge agent doc: per-slice review with .gate-frozen-N
  - agent: main
  - depends: [7]
  - file_targets: [.claude/agents/spec-judge.md]
  - boundary: [.claude/agents/spec-judge.md]

- [x] 10. spec-implementer agent doc: per-slice impl + slice-revision-blocker
  - agent: main
  - depends: [7]
  - file_targets: [.claude/agents/spec-implementer.md]
  - boundary: [.claude/agents/spec-implementer.md]

- [x] 11. constitution §4: slice-RED rules + kind:code gating
  - agent: main
  - depends: []
  - file_targets: [specs/constitution.md]
  - boundary: [specs/constitution.md]

- [x] 12. Smoke script: assert all slice-RED invariants pass
  - agent: main
  - depends: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  - file_targets: [scripts/smoke-slice-red.ts]
  - boundary: [scripts/smoke-slice-red.ts]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
