## Tasks

Each slice is a full TDD micro-cycle: spec-tester writes the gate RED → spec-judge freezes
it → spec-implementer makes it GREEN. Slices are sequential (each depends on the one
before) because the parser must exist before aggregation, which must exist before
formatting, which must exist before the CLI entry point is wired up.

- id: 1
  title: "Fixture + JSONL parser"
  agent: main
  depends_on: []
  touches:
    - scripts/pipeline-report.ts
    - scripts/fixtures/pipeline-report-trace.jsonl
  file_targets:
    - scripts/pipeline-report.ts
    - scripts/fixtures/pipeline-report-trace.jsonl
  boundary:
    - scripts/pipeline-report.ts
    - scripts/fixtures/pipeline-report-trace.jsonl
    - scripts/pipeline-report-parse.test.ts
  gate: scripts/pipeline-report-parse.test.ts

- id: 2
  title: "Session aggregator (tokens + duration)"
  agent: main
  depends_on: [1]
  touches:
    - scripts/pipeline-report.ts
  file_targets:
    - scripts/pipeline-report.ts
  boundary:
    - scripts/pipeline-report.ts
    - scripts/pipeline-report-agg.test.ts
  gate: scripts/pipeline-report-agg.test.ts

- id: 3
  title: "Output formatter (four sections)"
  agent: main
  depends_on: [2]
  touches:
    - scripts/pipeline-report.ts
  file_targets:
    - scripts/pipeline-report.ts
  boundary:
    - scripts/pipeline-report.ts
    - scripts/pipeline-report-format.test.ts
  gate: scripts/pipeline-report-format.test.ts

- id: 4
  title: "Edge case + package.json entry"
  agent: main
  depends_on: [3]
  touches:
    - scripts/pipeline-report.ts
    - package.json
  file_targets:
    - scripts/pipeline-report.ts
    - package.json
  boundary:
    - scripts/pipeline-report.ts
    - package.json
    - scripts/pipeline-report-edge.test.ts
  gate: scripts/pipeline-report-edge.test.ts
