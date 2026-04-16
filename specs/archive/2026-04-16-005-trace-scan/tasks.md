# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.

- [x] 1. Write RED smoke + unit test stubs (both fail because trace-scan.ts is not yet implemented)
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-trace-scan.ts, scripts/trace-scan.test.ts]
- [x] 2. Implement scripts/trace-scan.ts to satisfy the smoke and unit tests (GREEN)
  - agent: main
  - depends: [1]
  - file_targets: [scripts/trace-scan.ts]
- [x] 3. Write findings.md audit trail (retro origin)
  - agent: main
  - depends: []
  - file_targets: [specs/active/005-trace-scan/findings.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
