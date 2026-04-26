# Tasks — 037 Refactor pass after green for kind:code

- [ ] Allow Edit/Write of .claude/agents/** in settings.json
  - agent: main
  - depends: []
  - file_targets: [.claude/settings.json]
  - boundary: [.claude/settings.json]
  - note: Bootstrap edit — performed by main session because the implementer cannot grant itself permission. Adds `Edit(.claude/agents/**)`, `Write(.claude/agents/**)`, and the `.agentic/worktrees/**/.claude/agents/**` variants to `permissions.allow`.

- [ ] Add Step 6.5 Refactor pass section to spec-implementer.md
  - agent: main
  - depends: [Allow Edit/Write of .claude/agents/** in settings.json]
  - file_targets: [.claude/agents/spec-implementer.md]
  - boundary: [.claude/agents/spec-implementer.md]

- [ ] Replace exit-1 stub with real assertions in smoke-implementer-refactor.ts
  - agent: main
  - depends: [Add Step 6.5 Refactor pass section to spec-implementer.md]
  - file_targets: [scripts/smoke-implementer-refactor.ts]
  - boundary: [scripts/smoke-implementer-refactor.ts]
