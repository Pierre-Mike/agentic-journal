# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.

- [ ] 1. Write RED unit tests for pure fns (`parseFailingChecks`, `extractRunId`, `formatFailureBrief`) — test file compiles but tests fail because `scripts/ci-feedback.ts` does not yet exist.
  - agent: main
  - depends: []
  - file_targets: [scripts/ci-feedback.test.ts]
- [ ] 2. Implement pure functions in `scripts/ci-feedback.ts` so the unit tests go green.
  - agent: main
  - depends: [1]
  - file_targets: [scripts/ci-feedback.ts]
- [ ] 3. Implement IO helpers + CLI inside `scripts/ci-feedback.ts` (`fetchPrChecks`, `fetchFailingLogs`, `writeBrief`, `resolveActiveSpecDir`, `run`, `import.meta.main` guard).
  - agent: main
  - depends: [2]
  - file_targets: [scripts/ci-feedback.ts]
- [ ] 4. Replace the RED stub in `scripts/smoke-ci-feedback.ts` with the fixture-mocked smoke harness.
  - agent: main
  - depends: [3]
  - file_targets: [scripts/smoke-ci-feedback.ts]
- [ ] 5. Update `.claude/skills/do/SKILL.md` — Step 9 invokes `bun scripts/ci-feedback.ts` on red CI; Step 10 paused report cites `ci-failure.md`.
  - agent: main
  - depends: [4]
  - file_targets: [.claude/skills/do/SKILL.md]
- [ ] 6. Final check: `bun run check` passes, `bun run spec:lint` passes, `bun run tasks:verify` reports 014 green.
  - agent: main
  - depends: [5]
  - file_targets: []

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
