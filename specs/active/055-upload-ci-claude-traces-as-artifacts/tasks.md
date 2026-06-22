## Tasks

- id: 1
  title: "Fix CI artifact naming and retention in intent.yml and slice.yml"
  agent: main
  depends_on: []
  touches:
    - .github/workflows/intent.yml
    - .github/workflows/slice.yml
  file_targets:
    - .github/workflows/intent.yml
    - .github/workflows/slice.yml
  boundary:
    - .github/workflows/intent.yml
    - .github/workflows/slice.yml
    - tests/055-ci-yaml-artifacts.test.ts
  gate: tests/055-ci-yaml-artifacts.test.ts

- id: 2
  title: "Create scripts/agentic/traces-fetch.ts and colocated test"
  agent: main
  depends_on: []
  touches:
    - scripts/agentic/traces-fetch.ts
    - scripts/agentic/traces-fetch.test.ts
  file_targets:
    - scripts/agentic/traces-fetch.ts
    - scripts/agentic/traces-fetch.test.ts
  boundary:
    - scripts/agentic/traces-fetch.ts
    - scripts/agentic/traces-fetch.test.ts
  gate: scripts/agentic/traces-fetch.test.ts

- id: 3
  title: "Add .claude/traces-mirror/ to .gitignore and update retro SKILL.md Step 2"
  agent: main
  depends_on: [2]
  touches:
    - .gitignore
    - .claude/skills/retro/SKILL.md
  file_targets:
    - .gitignore
    - .claude/skills/retro/SKILL.md
  boundary:
    - .gitignore
    - .claude/skills/retro/SKILL.md
    - tests/055-retro-config.test.ts
  gate: tests/055-retro-config.test.ts
