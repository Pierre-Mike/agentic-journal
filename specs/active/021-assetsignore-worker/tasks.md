# Tasks

- [ ] 1. Author `scripts/smoke-assetsignore.ts` with full assertion logic (existence + exact content match + clear diagnostics).
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-assetsignore.ts]
  - boundary: [scripts/smoke-assetsignore.ts]
- [ ] 2. Create `public/.assetsignore` containing exactly `_worker.js\n_worker.js/**\n` (two lines, trailing newline).
  - agent: main
  - depends: [1]
  - file_targets: [public/.assetsignore]
  - boundary: [public/.assetsignore]
