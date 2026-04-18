# Tasks

- [x] 1. RED stub: write smoke-canary.ts exiting 1 with "not yet implemented"
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-canary.ts]
- [x] 2. RED assertions: author scripts/canary-run.test.ts for score()
  - agent: main
  - depends: [1]
  - file_targets: [scripts/canary-run.test.ts]
- [x] 3. Implement pure fns in scripts/canary-run.ts (loadBaseline, runCanary, score, run)
  - agent: main
  - depends: [2]
  - file_targets: [scripts/canary-run.ts]
- [x] 4a. [P] Build canary-spec-template-shape.ts fixture
  - agent: main
  - depends: [3]
  - file_targets: [canaries/scripts/canary-spec-template-shape.ts]
- [x] 4b. [P] Build canary-hook-block-allowlist.ts fixture
  - agent: main
  - depends: [3]
  - file_targets: [canaries/scripts/canary-hook-block-allowlist.ts]
- [x] 5. Lock baseline: write canaries/baseline.json
  - agent: main
  - depends: [4a, 4b]
  - file_targets: [canaries/baseline.json]
- [x] 6. Upgrade smoke-canary.ts from RED stub to real end-to-end assertions over tmpdir baseline
  - agent: main
  - depends: [5]
  - file_targets: [scripts/smoke-canary.ts]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually. Validation (`bun run check` + `spec:lint` + `tasks:verify`) runs as part of spec-complete's gate check — no separate task.
