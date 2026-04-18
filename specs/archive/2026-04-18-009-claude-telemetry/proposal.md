---
id: 009-claude-telemetry
title: Enable Claude Code native telemetry env var
status: archived
kind: workflow
gate: scripts/smoke-telemetry.ts
created: 2026-04-18T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-18'
---

## Intent

Anthropic ships free OTLP telemetry behind the `CLAUDE_CODE_ENABLE_TELEMETRY=1` environment variable. When set, Claude Code emits per-session token in/out, cost in USD, session count, and tool counts at zero configuration cost. The harness currently does not set this variable, so every session runs blind to its own token/cost profile — a systematic loss of observability data the harness could consume in `/retro`, trace-scan aggregations, and future feedback loops. This spec closes the gap: documents where the variable must be set, provides a smoke script that asserts the expected state, and ensures agents operating inside `bun` scripts inherit the flag.

## Constraints

- TypeScript strict; no `any`, no `as` outside tests; smoke mirrors `scripts/smoke-harness-fixes.ts` (`mkdtempSync`/`assertTrue`/`process.exit(failed > 0 ? 1 : 0)`)
- No external dependencies
- Protected paths untouched: no edits to `wrangler.toml`, no edits to `content/posts/*.mdx`
- Do NOT modify `scripts/trace-scan.ts` — telemetry-into-trace-scan is spec 011 territory, explicitly out of scope
- No OTLP collector setup — scope is: flip the flag + document it + gate the state
- Env var source must be something every `bun run` child process and `claude` invocation in this repo will inherit without manual shell gymnastics

## Non-goals

- Wiring OTLP output into `trace-scan.ts` aggregator (future spec 011)
- Running a local/remote OTLP collector backend
- Dashboards, alerts, cost budgets
- Any change to the CI pipeline's secret/env configuration

## Acceptance criteria

- [ ] `scripts/smoke-telemetry.ts` exists and exits 0 when `CLAUDE_CODE_ENABLE_TELEMETRY=1` is set in the script's `process.env`
- [ ] `scripts/smoke-telemetry.ts` exits 1 with a clear remediation message when the env var is unset or not equal to `"1"`
- [ ] `AGENTS.md` documents the env var in one paragraph — name, value, where to set it, what data it emits
- [ ] `bun run check` passes (typecheck + lint + test + spec-lint)
- [ ] `bun run spec:lint` passes
- [ ] `bun run tasks:verify` reports `✓ 009-claude-telemetry (workflow) — 1 workflow smoke(s) pass`

## Context

- Gap analysis 2026-04-18: Anthropic's Claude Code telemetry is opt-in via a single env var and produces structured OTLP data for free. Unset in this repo today.
- Smoke pattern reference: `scripts/smoke-harness-fixes.ts`, `scripts/smoke-trace-scan.ts`
- Workflow gate dispatcher: `scripts/gates/smoke.ts`
- Spec 011 (future) will merge telemetry data into the trace aggregator — this spec is the precondition
