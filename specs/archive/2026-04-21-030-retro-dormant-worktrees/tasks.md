# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`,
and `boundary`.

- `file_targets` is the set of files the task INTENDS to touch — `spec-complete.ts`
  uses it to tick the box when those exact paths are modified.
- `boundary` is the set of glob patterns the task is ALLOWED to touch. Every
  file a task actually modifies must match at least one glob here, or
  `tasks-verify.ts` will fail the spec.

Gate `scripts/smoke-retro-dormant.ts` is frozen — do NOT include in any task's
`file_targets`.

- [x] 1. Write `scripts/retro-preflight.ts` with `detectDormantWorktrees()` export and CLI entrypoint
  - agent: main
  - depends: []
  - file_targets: [scripts/retro-preflight.ts]
  - boundary: [scripts/retro-preflight.ts]
- [x] 2. Amend `.claude/skills/retro/SKILL.md` Step 2 to invoke preflight and inline output
  - agent: main
  - depends: [1]
  - file_targets: [.claude/skills/retro/SKILL.md]
  - boundary: [.claude/skills/retro/SKILL.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
