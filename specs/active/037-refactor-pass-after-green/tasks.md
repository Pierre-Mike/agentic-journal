# Tasks — 036 Refactor pass after green for kind:code

- [ ] Add Step 6.5 Refactor pass section to spec-implementer.md
  - agent: main
  - depends: []
  - file_targets: [.claude/agents/spec-implementer.md]
  - boundary: [.claude/agents/spec-implementer.md]

- [ ] Replace exit-1 stub with real assertions in smoke-implementer-refactor.ts
  - agent: main
  - depends: [Add Step 6.5 Refactor pass section to spec-implementer.md]
  - file_targets: [scripts/smoke-implementer-refactor.ts]
  - boundary: [scripts/smoke-implementer-refactor.ts]
