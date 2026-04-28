# Tasks — post-slice re-plan hook

- [ ] 1. Write gate validator `scripts/smoke-replan-flow.ts` (RED)
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-replan-flow.ts]
  - boundary: [scripts/smoke-replan-flow.ts]

- [ ] 2. Author `.claude/agents/spec-replanner.md` agent definition
  - agent: main
  - depends: []
  - file_targets: [.claude/agents/spec-replanner.md]
  - boundary: [.claude/agents/spec-replanner.md]

- [ ] 3. Edit `.claude/skills/do/SKILL.md` Step 6 to insert replanner dispatch
  - agent: main
  - depends: [2]
  - file_targets: [.claude/skills/do/SKILL.md]
  - boundary: [.claude/skills/do/SKILL.md]

- [ ] 4. Document replanner in `specs/constitution.md`
  - agent: main
  - depends: []
  - file_targets: [specs/constitution.md]
  - boundary: [specs/constitution.md]
