# Tasks

- [ ] 1. Author `scripts/smoke-assetsignore.test.ts` — dual-mode (bun:test + script) assertion of existence + exact content of `public/.assetsignore`, with clear diagnostics on miss.
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-assetsignore.test.ts]
  - boundary: [scripts/smoke-assetsignore.test.ts]
- [ ] 2. Create `public/.assetsignore` containing exactly `_worker.js\n_worker.js/**\n` (two lines, trailing newline).
  - agent: main
  - depends: [1]
  - file_targets: [public/.assetsignore]
  - boundary: [public/.assetsignore]
