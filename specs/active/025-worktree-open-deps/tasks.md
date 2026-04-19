# Tasks

- [ ] 1. Author RED gate (shape + behavior cases) in scripts/worktree-open.test.ts
  - agent: main
  - depends: []
  - file_targets: [scripts/worktree-open.test.ts]
  - boundary: [scripts/worktree-open.test.ts]
- [ ] 2. Extend scripts/worktree-open.ts with `bun install --frozen-lockfile` post-`git worktree add`; add failure handler (diagnostic + exit 1)
  - agent: main
  - depends: [1]
  - file_targets: [scripts/worktree-open.ts]
  - boundary: [scripts/worktree-open.ts]
- [ ] 3. Verify gate green via `bun test scripts/worktree-open.test.ts`
  - agent: main
  - depends: [2]
  - file_targets: [scripts/worktree-open.test.ts, scripts/worktree-open.ts]
  - boundary: [scripts/worktree-open.test.ts, scripts/worktree-open.ts]
