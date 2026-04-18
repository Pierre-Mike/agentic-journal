# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.

- [ ] 1. Extend hook event types with optional span fields
  - agent: main
  - depends: []
  - file_targets: [.claude/hooks/types.ts]
- [ ] 2. Author RED tests for detectors + backward compat
  - agent: main
  - depends: [1]
  - file_targets: [scripts/trace-scan.test.ts]
- [ ] 3a. [P] Implement detectLoops
  - agent: main
  - depends: [2]
  - file_targets: [scripts/trace-scan.ts]
- [ ] 3b. [P] Implement detectDrift
  - agent: main
  - depends: [2]
  - file_targets: [scripts/trace-scan.ts]
- [ ] 3c. [P] Implement detectRetryStorm
  - agent: main
  - depends: [2]
  - file_targets: [scripts/trace-scan.ts]
- [ ] 4. Extend aggregate() + TraceScanReport with detector summaries and renderer lines
  - agent: main
  - depends: [3a, 3b, 3c]
  - file_targets: [scripts/trace-scan.ts]
- [ ] 5. Update observe.ts to populate new span fields
  - agent: main
  - depends: [1]
  - file_targets: [.claude/hooks/observe.ts]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
