# Tasks

- [ ] 1. Author smoke script with assertion logic
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-preview-workflow.ts]
  - boundary: [scripts/smoke-preview-workflow.ts]
- [ ] 2. Patch preview.yml — add env block + `--env=""` flag
  - agent: main
  - depends: [1]
  - file_targets: [.github/workflows/preview.yml]
  - boundary: [.github/workflows/preview.yml]
