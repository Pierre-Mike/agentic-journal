# Tasks

- [x] 1. Add sliceProgress() helper to _lib.ts
  - agent: main
  - depends: []
  - gate: scripts/_lib.test.ts
  - file_targets: [scripts/_lib.ts, scripts/_lib.test.ts]
  - boundary: [scripts/_lib.ts, scripts/_lib.test.ts]
- [x] 2. Wire sliceProgress into spec-status output
  - agent: main
  - depends: [1]
  - gate: scripts/spec-status.test.ts
  - file_targets: [scripts/spec-status.ts, scripts/spec-status.test.ts]
  - boundary: [scripts/spec-status.ts, scripts/spec-status.test.ts]
