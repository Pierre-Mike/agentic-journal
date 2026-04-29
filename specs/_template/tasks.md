# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`,
and `boundary`.

- `file_targets` is the set of files the task INTENDS to touch — `spec-complete.ts`
  uses it to tick the box when those exact paths are modified.
- `boundary` is the set of glob patterns the task is ALLOWED to touch. Every
  file a task actually modifies must match at least one glob here, or
  `tasks-verify.ts` will fail the spec. Globs are evaluated by `Bun.Glob`
  against repo-relative POSIX paths.
  - Single-segment `*` (e.g. `scripts/*.ts`) does NOT cross directory
    boundaries. Use `**` (e.g. `src/**/*.ts`) for recursive matches.
  - `["*"]` is a rare escape hatch meaning "any file" — use sparingly and
    justify in design.md.
  - Missing `boundary:` is currently a deprecation warning, not an error.
    Add one to every new task.
- `gate:` (kind:code specs only) — the gate file for this task's slice. The
  spec-tester writes this file in RED form for slice N; the spec-judge reviews
  it and touches `.gate-frozen-N` on PASS; the spec-implementer makes it green.
  Gate paths must be unique within the spec; ordinals 1..N must be contiguous.
  Non-code specs (rule/workflow/writeup) do NOT declare per-task `gate:` fields.

Parallel-safe siblings are marked `[P]`.

- [ ] 1. First task
  - agent: main
  - depends: []
  - depends_on: []
  - gate: src/foo.test.ts
  - file_targets: [path/to/file.ts]
  - boundary: [path/to/file.ts]
  - touches: [path/to/file.ts]
- [ ] 2a. [P] Parallel task A
  - agent: main
  - depends: [1]
  - depends_on: [1]
  - gate: scripts/smoke-foo-integration.ts
  - file_targets: [path/to/a.ts]
  - boundary: [path/to/a.ts, path/to/a.test.ts]
  - touches: [path/to/a.ts]
- [ ] 2b. [P] Parallel task B
  - agent: main
  - depends: [1]
  - depends_on: [1]
  - file_targets: [path/to/b.ts]
  - boundary: [path/to/b.ts, path/to/b.test.ts]
  - touches: [path/to/b.ts]
- [ ] 3. Final task
  - agent: main
  - depends: [2a, 2b]
  - depends_on: [2]
  - file_targets: [path/to/final.ts]
  - boundary: [path/to/**/*.ts]
  - touches: [path/to/final.ts]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
