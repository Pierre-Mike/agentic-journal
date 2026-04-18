---
id: 012-canary-skill-suite
title: Skill canary suite — gate skill changes against locked baseline
status: archived
kind: workflow
gate: scripts/smoke-canary.ts
created: 2026-04-18T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-18'
---

## Intent

Today any change to `.claude/skills/` or `.claude/hooks/` ships with no minimum-viable eval — the harness has zero canaries. Anthropic's eval guide blesses 20-50 simple tasks as the starting point; we start at 0. Build the FRAMEWORK + 2 deterministic dry-run fixtures so future PRs can extend the canary set. Real `/do`-recursion canaries (which would shell out to `claude -p`) are explicitly out of scope — too expensive for CI today. This spec delivers a pure scoring harness plus a locked baseline, not a full eval suite.

## Constraints

- TS strict, no `any`, no `as` outside tests.
- Named parameters for functions with 3+ args.
- Pure fns separate from IO: `loadBaseline`, `runCanary`, `score` are testable in isolation.
- Each canary script under `canaries/scripts/<id>.ts` is itself deterministic — no LLM calls, no network.
- NEVER invoke `/do` or `claude -p` from a canary in this spec.
- Baseline update requires `CANARY_UPDATE=1` env guard — cannot fire accidentally.
- Smoke follows `scripts/smoke-trace-scan.ts` shape: `mkdtempSync` fixtures, real assertions, exit non-zero on any fail.

## Acceptance criteria

- [ ] `scripts/canary-run.ts` exists, exports pure `loadBaseline`, `runCanary`, `score`, plus `run` CLI with flags `--baseline`, `--filter`, `--format`, `--update-baseline`.
- [ ] `scripts/canary-run.test.ts` exists; `bun test scripts/canary-run.test.ts` passes.
- [ ] `scripts/smoke-canary.ts` exists and exits 0 when the framework is implemented.
- [ ] `canaries/baseline.json` exists with 2 deterministic fixtures: `canary-spec-template-shape` and `canary-hook-block-allowlist`.
- [ ] `canaries/scripts/canary-spec-template-shape.ts` exists, runs deterministically, exits 0 when `specs/_template/{proposal,tasks,design}.md` all exist with required sections.
- [ ] `canaries/scripts/canary-hook-block-allowlist.ts` exists, runs deterministically, simulates a blocked enforce.ts invocation and exits 0 when the block fires.
- [ ] Running `bun scripts/canary-run.ts` against the default baseline exits 0 and prints `pass rate 100%`.
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for `012-canary-skill-suite`.

## Context

- Constitution §2 (deterministic-first): canary scripts are deterministic, not skill-driven.
- Anthropic eval guide: 20-50 simple tasks is a reasonable MVP; this spec is the scaffold, not the final count.
- Out of scope: real `/do`-recursion canaries, SWE-bench integration, LLM-as-judge graders, CI hook to require canary green on `.claude/` PRs — all deferred to separate specs.
