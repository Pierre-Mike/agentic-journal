# Tasks

- [ ] 1. Author RED gate (shape + behavior cases) in scripts/worktree-close.test.ts
  - agent: main
  - depends: []
  - file_targets: [scripts/worktree-close.test.ts]
  - boundary: [scripts/worktree-close.test.ts]
- [ ] 2. Extend scripts/worktree-close.ts — `git worktree prune` at top of main(); dir-missing + merged branch in closeOne() runs `git branch -D` after isMerged guard
  - agent: main
  - depends: [1]
  - file_targets: [scripts/worktree-close.ts]
  - boundary: [scripts/worktree-close.ts]
- [ ] 3. Verify gate green via `bun test scripts/worktree-close.test.ts` and `bun run tasks:verify`
  - agent: main
  - depends: [2]
  - file_targets: [scripts/worktree-close.ts, scripts/worktree-close.test.ts]
  - boundary: [scripts/worktree-close.ts, scripts/worktree-close.test.ts]
