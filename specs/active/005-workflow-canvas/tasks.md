# Tasks

- [ ] 1. Author smoke-script gate for canvas validation
  - agent: main
  - depends: []
  - file_targets: [scripts/gates/canvas-valid.ts]
- [ ] 2. Generate canvas node/edge/group structure
  - agent: main
  - depends: [1]
  - file_targets: [docs/agentic-workflow.canvas]
- [ ] 3. Verify canvas passes smoke gate
  - agent: main
  - depends: [2]
  - file_targets: [docs/agentic-workflow.canvas]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
