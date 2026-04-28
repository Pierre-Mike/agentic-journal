# Tasks — 046-do-auto-headless

- [ ] 1. Write gate fixture (RED until tasks 2-3 land)
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-do-auto-flow.ts]
  - boundary: [scripts/smoke-do-auto-flow.ts]

- [ ] 2. Write auto-aligner agent
  - agent: main
  - depends: []
  - file_targets: [.claude/agents/auto-aligner.md]
  - boundary: [.claude/agents/auto-aligner.md]

- [ ] 3. Write do-auto skill
  - agent: main
  - depends: [2]
  - file_targets: [.claude/skills/do-auto/SKILL.md]
  - boundary: [.claude/skills/do-auto/SKILL.md, scripts/smoke-do-auto-flow.ts]

- [ ] 4. Document auto-pilot mode in constitution
  - agent: main
  - depends: [2, 3]
  - file_targets: [specs/constitution.md]
  - boundary: [specs/constitution.md]
