# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`,
and `boundary`.

- [ ] 1. Author auto-pilot-loop.canvas with all required nodes, edges, and swim-lane groups
  - agent: main
  - depends: []
  - file_targets: [docs/auto-pilot-loop.canvas]
  - boundary: [docs/auto-pilot-loop.canvas]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
