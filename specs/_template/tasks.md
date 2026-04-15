# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.

Parallel-safe siblings are marked `[P]`.

- [ ] 1. First task
  - agent: main
  - depends: []
  - file_targets: [path/to/file.ts]
- [ ] 2a. [P] Parallel task A
  - agent: main
  - depends: [1]
  - file_targets: [path/to/a.ts]
- [ ] 2b. [P] Parallel task B
  - agent: main
  - depends: [1]
  - file_targets: [path/to/b.ts]
- [ ] 3. Final task
  - agent: main
  - depends: [2a, 2b]
  - file_targets: [path/to/final.ts]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
