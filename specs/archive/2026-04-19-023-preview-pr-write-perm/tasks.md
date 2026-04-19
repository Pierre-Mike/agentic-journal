# Tasks

- [x] 1. Add PREVIEW_WORKFLOW_PATH env override + colocated RED test
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-preview-workflow.ts, scripts/smoke-preview-workflow.test.ts]
  - boundary: [scripts/smoke-preview-workflow.ts, scripts/smoke-preview-workflow.test.ts]
- [x] 2. Extend gate to assert workflow-scope permissions block contains `pull-requests: write`
  - agent: main
  - depends: [1]
  - file_targets: [scripts/smoke-preview-workflow.ts]
  - boundary: [scripts/smoke-preview-workflow.ts]
- [x] 3. Add permissions block to .github/workflows/preview.yml
  - agent: main
  - depends: [2]
  - file_targets: [.github/workflows/preview.yml]
  - boundary: [.github/workflows/preview.yml]
