# Tasks

- [x] 1. Add `@playwright/test` dev dep, `e2e` script, Playwright config, gitignore entries
  - agent: main
  - depends: []
  - file_targets: [package.json, playwright.config.ts, .gitignore]
- [x] 2. Write gate smoke
  - agent: main
  - depends: [1]
  - file_targets: [scripts/smoke-e2e.ts]
- [x] 3. Write the three e2e test files and fixtures
  - agent: main
  - depends: [1]
  - file_targets: [e2e/homepage.e2e.ts, e2e/post-page.e2e.ts, e2e/not-found.e2e.ts, e2e/fixtures.ts]
- [x] 4. Add CI job
  - agent: main
  - depends: [1]
  - file_targets: [.github/workflows/ci.yml]
