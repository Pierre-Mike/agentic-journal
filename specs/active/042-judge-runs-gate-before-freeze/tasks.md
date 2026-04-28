# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `gate`, `file_targets`, and `boundary`.

- [ ] 1. red-proof.ts skeleton + unit tests for runner dispatch and exit-code mapping
  - agent: main
  - depends: []
  - gate: scripts/red-proof.test.ts
  - file_targets: [scripts/red-proof.ts, scripts/red-proof.test.ts]
  - boundary: [scripts/red-proof.ts, scripts/red-proof.test.ts]

- [ ] 2. Output truncation + timeout semantics in red-proof.ts (extend test matrix)
  - agent: main
  - depends: [1]
  - gate: scripts/red-proof.spawn.test.ts
  - file_targets: [scripts/red-proof.ts, scripts/red-proof.spawn.test.ts]
  - boundary: [scripts/red-proof.ts, scripts/red-proof.spawn.test.ts]

- [ ] 3. Update /do SKILL.md Step 6 pseudocode with proof step
  - agent: main
  - depends: []
  - gate: .claude/agents/spec-judge.md
  - file_targets: [.claude/skills/do/SKILL.md, .claude/agents/spec-judge.md]
  - boundary: [.claude/skills/do/SKILL.md, .claude/agents/spec-judge.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
