# Tasks — BDD outer acceptance gate

- [x] 1. Write RED gate validator
  - agent: main
  - depends: []
  - file_targets: [scripts/check-outer-gate-flow.ts]
  - boundary: [scripts/check-outer-gate-flow.ts]

- [x] 2. Update spec-tester to scaffold outer gate at Step 5 for kind:code
  - agent: main
  - depends: []
  - file_targets: [.claude/agents/spec-tester.md]
  - boundary: [.claude/agents/spec-tester.md]

- [x] 3. Update spec-judge to review outer gate against alignment.md
  - agent: main
  - depends: []
  - file_targets: [.claude/agents/spec-judge.md]
  - boundary: [.claude/agents/spec-judge.md]

- [x] 4. Update spec-complete to verify outer gate before archive
  - agent: main
  - depends: []
  - file_targets: [scripts/spec-complete.ts]
  - boundary: [scripts/spec-complete.ts]

- [x] 5. Update /do SKILL.md to document outer gate flow
  - agent: main
  - depends: [2, 3, 4]
  - file_targets: [.claude/skills/do/SKILL.md]
  - boundary: [.claude/skills/do/SKILL.md]

- [x] 6. Update constitution to document outer/inner gate split
  - agent: main
  - depends: []
  - file_targets: [specs/constitution.md]
  - boundary: [specs/constitution.md]
