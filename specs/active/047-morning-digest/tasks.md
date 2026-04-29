# Tasks

- [ ] 1. Write gate fixture `scripts/smoke-morning-digest.ts` (RED until task 2 lands)
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-morning-digest.ts]
  - boundary: [scripts/smoke-morning-digest.ts]

- [ ] 2. Write core scan logic `scripts/morning-digest.ts`
  - agent: main
  - depends: []
  - file_targets: [scripts/morning-digest.ts]
  - boundary: [scripts/morning-digest.ts]

- [x] 3. Gitignore — confirmed no edit needed (`.agentic/` line already covers `.agentic/digest/`)
  - agent: main
  - depends: []
  - file_targets: []
  - boundary: []

- [ ] 4. Land morning-digest skill file
  - agent: main
  - depends: [2]
  - file_targets: [.claude/skills/morning-digest/SKILL.md, specs/active/047-morning-digest/SKILL-content-for-handoff.md]
  - boundary: [.claude/skills/morning-digest/SKILL.md, specs/active/047-morning-digest/SKILL-content-for-handoff.md]
  - Worker authored content in `SKILL-content-for-handoff.md`; parent landed actual skill file (worker permission limitation on creating new files under `.claude/skills/`).

- [ ] 5. Document morning digest in `specs/constitution.md` §4
  - agent: main
  - depends: []
  - file_targets: [specs/constitution.md]
  - boundary: [specs/constitution.md]
