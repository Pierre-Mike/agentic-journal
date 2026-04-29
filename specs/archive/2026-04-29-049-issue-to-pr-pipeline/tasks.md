## Tasks

- id: 1
  title: "tasks.md schema: add depends_on and touches"
  agent: main
  depends_on: []
  touches:
    - specs/_template/tasks.md
    - scripts/spec-lint.ts
  file_targets:
    - specs/_template/tasks.md
    - scripts/spec-lint.ts
  boundary:
    - specs/_template/**
    - scripts/spec-lint.ts
    - scripts/spec-lint.test.ts
  gate: scripts/spec-lint.test.ts

- id: 2
  title: "dag-controller.ts: DAG eval + touches-intersection"
  agent: main
  depends_on: [1]
  touches:
    - scripts/dag-controller.ts
    - scripts/dag-controller.test.ts
  file_targets:
    - scripts/dag-controller.ts
  boundary:
    - scripts/dag-controller.ts
    - scripts/dag-controller.test.ts
  gate: scripts/dag-controller.test.ts

- id: 3
  title: "issue-options.ts: failure menu emitter"
  agent: main
  depends_on: []
  touches:
    - scripts/issue-options.ts
    - scripts/issue-options.test.ts
  file_targets:
    - scripts/issue-options.ts
  boundary:
    - scripts/issue-options.ts
    - scripts/issue-options.test.ts
  gate: scripts/issue-options.test.ts

- id: 4
  title: "CODEOWNERS: freeze alignment.md"
  agent: main
  depends_on: []
  touches:
    - .github/CODEOWNERS
  file_targets:
    - .github/CODEOWNERS
  boundary:
    - .github/CODEOWNERS
  gate: tests/codeowners.test.ts

- id: 5
  title: "bootstrap.yml: issue→branch→aligner→spec"
  agent: main
  depends_on: [4]
  touches:
    - .github/workflows/bootstrap.yml
  file_targets:
    - .github/workflows/bootstrap.yml
  boundary:
    - .github/workflows/bootstrap.yml
  gate: tests/workflows/bootstrap.test.ts

- id: 6
  title: "controller.yml: cron + DAG dispatch"
  agent: main
  depends_on: [2]
  touches:
    - .github/workflows/controller.yml
  file_targets:
    - .github/workflows/controller.yml
  boundary:
    - .github/workflows/controller.yml
  gate: tests/workflows/controller.test.ts

- id: 7
  title: "slice.yml: matrix runner with expertise skill"
  agent: main
  depends_on: [6]
  touches:
    - .github/workflows/slice.yml
  file_targets:
    - .github/workflows/slice.yml
  boundary:
    - .github/workflows/slice.yml
  gate: tests/workflows/slice.test.ts

- id: 8
  title: "preview.yml: wrangler + playwright + outer gate"
  agent: main
  depends_on: []
  touches:
    - .github/workflows/preview.yml
  file_targets:
    - .github/workflows/preview.yml
  boundary:
    - .github/workflows/preview.yml
  gate: tests/workflows/preview.test.ts

- id: 9
  title: "automerge.yml: aggregator + squash-merge"
  agent: main
  depends_on: [5, 6, 7, 8]
  touches:
    - .github/workflows/automerge.yml
    - scripts/issue-options.ts
  file_targets:
    - .github/workflows/automerge.yml
  boundary:
    - .github/workflows/automerge.yml
    - scripts/issue-options.ts
  gate: tests/workflows/automerge.test.ts

- id: 10
  title: "End-to-end pipeline integration"
  agent: main
  depends_on: [1, 2, 3, 4, 5, 6, 7, 8, 9]
  touches:
    - tests/automation-pipeline.test.ts
  file_targets:
    - tests/automation-pipeline.test.ts
  boundary:
    - tests/automation-pipeline.test.ts
  gate: tests/automation-pipeline.test.ts
