# Tasks

- [ ] 1. Write RED smoke gate asserting SKILL.md delegation anchors
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-do-delegation.ts]
- [ ] 2. Edit SKILL.md — add Step 2.5, prefix 3–10, add rule
  - agent: main
  - depends: [1]
  - file_targets: [.claude/skills/do/SKILL.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
