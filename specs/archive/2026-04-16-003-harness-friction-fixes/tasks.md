# Tasks

- [x] 1. Write RED smoke script with real assertions (fails before fixes)
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-harness-fixes.ts]
- [x] 2. Fix spec-guard to resolve repo root from filePath
  - agent: main
  - depends: [1]
  - file_targets: [.claude/hooks/spec-guard.ts]
- [x] 3. Fix spec-complete to accept slug-only, extract resolveSpec
  - agent: main
  - depends: [1]
  - file_targets: [scripts/spec-complete.ts]
- [x] 4. Edit /do skill (order, echo, Rules)
  - agent: main
  - depends: []
  - file_targets: [.claude/skills/do/SKILL.md]
- [x] 5. Add AGENTS.md clarifier line
  - agent: main
  - depends: []
  - file_targets: [AGENTS.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
