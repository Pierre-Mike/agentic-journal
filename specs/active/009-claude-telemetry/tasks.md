# Tasks

Ordered checklist. Each task declares its `agent`, `depends`, `file_targets`.

- [ ] 1. Write RED smoke gate that asserts `CLAUDE_CODE_ENABLE_TELEMETRY === "1"` and exits 1 with a remediation pointer when unset
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-telemetry.ts]
- [ ] 2. Prefix `tasks:verify` script in `package.json` with `CLAUDE_CODE_ENABLE_TELEMETRY=1` so the env var is inherited into the gate subprocess
  - agent: main
  - depends: [1]
  - file_targets: [package.json]
- [ ] 3. Add one-paragraph `## Observability` section to `AGENTS.md` describing the env var, what it emits, and where to set it for interactive `claude` sessions
  - agent: main
  - depends: []
  - file_targets: [AGENTS.md]

Task box ticking happens via `scripts/tasks-verify.ts`, not manually.
