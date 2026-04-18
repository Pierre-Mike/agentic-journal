# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`, and `boundary`.

- [ ] 1. Write RED colocated tests for validateBoundary + validateTaskSchema (the gate artifact)
  - agent: main
  - depends: []
  - file_targets: [scripts/spec-lint.test.ts]
  - boundary: [scripts/spec-lint.test.ts]
- [ ] 2. Implement validateBoundary + validateTaskSchema + parseTasksFile in scripts/spec-lint.ts; wire schema check into main()
  - agent: main
  - depends: [1]
  - file_targets: [scripts/spec-lint.ts]
  - boundary: [scripts/spec-lint.ts]
- [ ] 3. Wire boundary check into scripts/tasks-verify.ts
  - agent: main
  - depends: [2]
  - file_targets: [scripts/tasks-verify.ts]
  - boundary: [scripts/tasks-verify.ts]
- [ ] 4. Update specs/_template/tasks.md to document + demonstrate the boundary field
  - agent: main
  - depends: [2]
  - file_targets: [specs/_template/tasks.md]
  - boundary: [specs/_template/tasks.md]
- [ ] 5. Full check — bun run check + spec:lint + tasks:verify all green
  - agent: main
  - depends: [2, 3, 4]
  - file_targets: [specs/active/013-task-boundary-annotations/proposal.md]
  - boundary: [specs/active/013-task-boundary-annotations/*.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
