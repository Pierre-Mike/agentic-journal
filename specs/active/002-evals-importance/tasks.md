# Tasks

- [ ] 1. Create MDX stub (RED — frontmatter only, no required sections)
  - agent: main
  - depends: []
  - file_targets: [content/posts/evals-importance.mdx]
- [ ] 2. Fill Intent, Why, What, How sections (GREEN)
  - agent: main
  - depends: [1]
  - file_targets: [content/posts/evals-importance.mdx]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
