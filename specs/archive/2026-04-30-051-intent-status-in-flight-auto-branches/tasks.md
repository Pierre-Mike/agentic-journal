## Tasks

- id: 1
  title: "Pure helpers: formatAge, parseBranch, formatTable + unit tests"
  agent: main
  depends_on: []
  touches:
    - scripts/intent-status.ts
    - scripts/intent-status.test.ts
  file_targets:
    - scripts/intent-status.ts
    - scripts/intent-status.test.ts
  boundary:
    - scripts/intent-status.ts
    - scripts/intent-status.test.ts
  gate: scripts/intent-status.test.ts

- id: 2
  title: "main() entry point + package.json intent:status registration"
  agent: main
  depends_on: [1]
  touches:
    - scripts/intent-status.ts
    - package.json
  file_targets:
    - scripts/intent-status.ts
    - package.json
  boundary:
    - scripts/intent-status.ts
    - package.json
  gate: tests/intent-status-bdd.test.ts
