# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`,
and `boundary`.

- [ ] 1. Write the post `content/posts/templated-engineering.mdx` following the Intent → Why → What → How structure, with valid frontmatter and all four sections non-empty
  - agent: main
  - depends: []
  - file_targets: [content/posts/templated-engineering.mdx]
  - boundary: [content/posts/templated-engineering.mdx]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
