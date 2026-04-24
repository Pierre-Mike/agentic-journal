# Tasks

- [x] 1. Author gate script (RED)
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-do-dispatch-by-kind.ts]
  - boundary: [scripts/smoke-do-dispatch-by-kind.ts]
- [x] 2. Update SKILL.md Step 2.5 dispatch-chain + pseudocode guard
  - agent: main
  - depends: [1]
  - file_targets: [.claude/skills/do/SKILL.md]
  - boundary: [.claude/skills/do/SKILL.md]
