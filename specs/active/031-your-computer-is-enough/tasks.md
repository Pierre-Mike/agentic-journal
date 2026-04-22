# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`,
and `boundary`.

- [ ] 1. Write the post `content/posts/your-computer-is-enough.mdx` following the Intent → Why → What → How structure, with valid frontmatter and all four sections non-empty
  - agent: main
  - depends: []
  - file_targets: ["content/posts/your-computer-is-enough.mdx"]
  - boundary: ["content/posts/your-computer-is-enough.mdx"]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
