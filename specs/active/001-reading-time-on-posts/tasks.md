# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`. Parallel-safe siblings marked `[P]`.

- [ ] 1. Implement `readingTime` and `WPM` in `src/lib/reading-time.ts` so the gate passes
  - agent: main
  - depends: []
  - file_targets: [src/lib/reading-time.ts]
- [ ] 2. Wire into post route: call `readingTime(post.body)` and append `· {minutes} min read` to the existing meta line
  - agent: main
  - depends: [1]
  - file_targets: [src/pages/posts/[...slug].astro]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
