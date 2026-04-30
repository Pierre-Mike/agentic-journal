## Tasks

- id: 1
  title: "Pure functions: parseTraceContent + buildReport + formatReport + Zod schemas + unit tests"
  agent: main
  depends_on: []
  touches:
    - scripts/pipeline-report.ts
    - scripts/pipeline-report.test.ts
  file_targets:
    - scripts/pipeline-report.ts
    - scripts/pipeline-report.test.ts
  boundary:
    - scripts/pipeline-report.ts
    - scripts/pipeline-report.test.ts
  gate: scripts/pipeline-report.test.ts

- id: 2
  title: "main() CLI entry + package.json pipeline:report registration + BDD integration gate"
  agent: main
  depends_on: [1]
  touches:
    - scripts/pipeline-report.ts
    - package.json
  file_targets:
    - scripts/pipeline-report.ts
    - package.json
  boundary:
    - scripts/pipeline-report.ts
    - package.json
    - tests/pipeline-report-bdd.test.ts
  gate: tests/pipeline-report-bdd.test.ts
