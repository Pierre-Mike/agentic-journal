# Design

## Approach

Set `CLAUDE_CODE_ENABLE_TELEMETRY=1` at two touchpoints so the gate is deterministic in CI/local runs and humans know how to realize the effect in their own Claude sessions:

1. **`package.json` — prefix `tasks:verify` with the env var.** This makes `bun run tasks:verify` deterministic everywhere (CI, pre-push hook, local shell) because the bun script runner exports it before spawning `scripts/tasks-verify.ts`, which in turn inherits it into the `Bun.spawn` call for the smoke gate in `scripts/gates/smoke.ts`. No shell setup required on contributors.
2. **`AGENTS.md` — new `## Observability` section.** Documents the variable for humans: what it does (emits OTLP token/cost/session/tool metrics), where to set it for interactive `claude` sessions (shell `export` in `.zshrc`/`.bashrc` or a personal direnv `.envrc`), and the fact that the gate already ensures the CI state. One paragraph, no ceremony.

No `.envrc` file committed — direnv is not a repo dependency, adding one would be implicit tooling lock-in. Shell export is the lowest-friction path per-contributor; the package.json prefix covers the deterministic half.

## Files touched

- `scripts/smoke-telemetry.ts` — new. Asserts `process.env.CLAUDE_CODE_ENABLE_TELEMETRY === "1"`, prints remediation pointing at AGENTS.md when unset, exits 1 on failure. Mirrors `scripts/smoke-harness-fixes.ts` style.
- `package.json` — update `scripts.tasks:verify` to `CLAUDE_CODE_ENABLE_TELEMETRY=1 bun scripts/tasks-verify.ts`. One-line change.
- `AGENTS.md` — insert a `## Observability` section after `## Stack`. One paragraph explaining the env var and its purpose.
- `specs/active/009-claude-telemetry/{proposal,design,tasks}.md` — standard spec docs.

## Decisions

- **Prefix in `package.json`, not a separate `.envrc`** — direnv is not installed locally (`which direnv` → not found) and committing `.envrc` would pressure contributors to install it. The package.json prefix is zero-dep and deterministic.
- **Do NOT add the env var to `.github/workflows/ci.yml` directly** — `package.json` already propagates it to CI via `bun run tasks:verify`. Duplicating at the workflow level would create two sources of truth.
- **Doc in `AGENTS.md` §Observability, not README** — AGENTS.md is the onboarding entrypoint per the "Read First" rule; README is stack overview. Observability is agent-facing.
- **Gate remains strict (`=== "1"`)** — not `=== "true"` or truthy — because that's the exact string Anthropic's docs specify. Accepting fuzzier values would hide drift.
- **No change to `scripts/trace-scan.ts`** — merging telemetry into the aggregator is explicitly deferred to spec 011. This spec's scope ends at "the flag is on and asserted".

## Risks

- **Contributor shell won't have the var exported**, so interactive `claude` sessions won't actually emit telemetry even though CI/gates pass. Mitigation: the AGENTS.md paragraph is explicit about this, and the smoke's remediation message points at AGENTS.md. Future spec can add a pre-session check via `.claude/hooks.ts` if drift shows up.
- **`tasks:verify` env propagation on Windows shells** — `VAR=value bun ...` syntax is POSIX. Mitigation: the repo already requires POSIX shells (macOS + Linux CI), documented tooling assumption.

## Out of scope

- OTLP exporter endpoint, collector, backend
- Dashboards, alerting, cost budgets
- Merging telemetry data into `scripts/trace-scan.ts` (spec 011)
- Automated shell-rc editing / direnv installation
- Any `.env` file committed to the repo (gitignored per repo policy)
