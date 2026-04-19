# Tasks

- [ ] 1. Author Intent + Why sections (~250 words; 1 ASCII diagram in Why; engage TDD-orthodoxy critique)
  - agent: main
  - depends: []
  - file_targets: [content/posts/tdd-importance.mdx]
  - boundary: [content/posts/tdd-importance.mdx]
- [ ] 2. Author What section + ASCII triptych (~250 words; cite spec 016 RED-bypass)
  - agent: main
  - depends: [1]
  - file_targets: [content/posts/tdd-importance.mdx]
  - boundary: [content/posts/tdd-importance.mdx]
- [ ] 3. Author How section (~250 words; four concrete moves)
  - agent: main
  - depends: [2]
  - file_targets: [content/posts/tdd-importance.mdx]
  - boundary: [content/posts/tdd-importance.mdx]
- [ ] 4. Final pass — verify word count (700-900), link count (>=3), diagram count (==2), orthodoxy paragraph, spec-016 reference
  - agent: main
  - depends: [3]
  - file_targets: [content/posts/tdd-importance.mdx]
  - boundary: [content/posts/tdd-importance.mdx]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
