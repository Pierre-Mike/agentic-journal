## Tasks

YAML-list format. Each task is a `- id: N` block with required fields:
`title`, `agent`, `depends_on`, `touches`, `file_targets`, `boundary`, and
(for kind:code) `gate`.

- `file_targets` — files the task INTENDS to touch.
- `touches` — same set, used by the dispatch DAG to detect parallel-safe
  siblings (no overlap → can run concurrently).
- `boundary` — glob set the task is ALLOWED to touch. Every file the task
  actually modifies must match at least one glob, or `tasks-verify.ts`
  fails the spec. Globs evaluate against repo-relative POSIX paths via
  `Bun.Glob`. `**` for recursive matches; bare `*` does not cross
  directory boundaries. `["*"]` is an escape hatch — use sparingly and
  justify in design.md.
- `gate` (kind:code only) — gate file the task brings from RED to GREEN.
  Spec-tester writes RED; spec-judge freezes via `.gate-frozen-N`;
  spec-implementer makes it pass.

Slice IDs (1..N) must be contiguous. Gate paths must be unique within
the spec. Parallel-safe siblings have non-overlapping `touches`.

- id: 1
  title: "First task"
  agent: main
  depends_on: []
  touches:
    - path/to/file.ts
  file_targets:
    - path/to/file.ts
  boundary:
    - path/to/file.ts
  gate: src/foo.test.ts

- id: 2
  title: "Parallel sibling A"
  agent: main
  depends_on: [1]
  touches:
    - path/to/a.ts
  file_targets:
    - path/to/a.ts
  boundary:
    - path/to/a.ts
    - path/to/a.test.ts
  gate: scripts/smoke-foo-integration.ts

- id: 3
  title: "Final task"
  agent: main
  depends_on: [2]
  touches:
    - path/to/final.ts
  file_targets:
    - path/to/final.ts
  boundary:
    - path/to/**/*.ts
  gate: path/to/final.test.ts
