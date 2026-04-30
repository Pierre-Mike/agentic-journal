## Tasks

- id: 1
  title: "Pure functions: parsePrList, formatLine, Tally type + unit tests"
  agent: main
  depends_on: []
  touches:
    - scripts/auto-status.ts
    - scripts/auto-status.test.ts
  file_targets:
    - scripts/auto-status.ts
    - scripts/auto-status.test.ts
  boundary:
    - scripts/auto-status.ts
    - scripts/auto-status.test.ts
  gate: scripts/auto-status.test.ts

- id: 2
  title: "main() entry point + package.json auto:status registration"
  agent: main
  depends_on: [1]
  touches:
    - scripts/auto-status.ts
    - package.json
  file_targets:
    - scripts/auto-status.ts
    - package.json
  boundary:
    - scripts/auto-status.ts
    - package.json
    - tests/auto-status-bdd.test.ts
  gate: tests/auto-status-bdd.test.ts
