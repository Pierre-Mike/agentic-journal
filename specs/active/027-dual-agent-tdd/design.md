# Design

## Approach

Three-agent TDD restructure of `/do`. Main `/do` session orchestrates serially via native Claude Code `.claude/agents/*.md` dispatch. Three-layer enforcement: (1) tool allowlist in agent frontmatter — outer gate; (2) pre-tool-use hook reading a `.gate-frozen` sentinel — hard per-path wall; (3) prompt preamble in each agent body — LLM-internal clarity. Retry cap is 3 judge reviews; on 3-strike FAIL the judge writes a structured `blocker.md` and the main session exits with new status `escalated`. Writeups skip the judge entirely (prose-quality rubric is a different spec). Filesystem state (`.gate-frozen`, `blocker.md`, `tester-review.md`) makes the orchestration observable; no new orchestrator subagent.

## Files touched

- `specs/active/027-dual-agent-tdd/proposal.md` — already written
- `specs/active/027-dual-agent-tdd/design.md` — this file
- `specs/active/027-dual-agent-tdd/tasks.md` — ordered task list
- `scripts/smoke-dual-agent-do.ts` — RED shape gate (already written)
- `scripts/smoke-dual-agent-do.test.ts` — gate's colocated bun:test (already written)
- `.claude/agents/spec-tester.md` — new: Sonnet; authors proposal/design/tasks/gate in RED
- `.claude/agents/spec-judge.md` — new: Opus (different family); rubric-scored verdict; touches `.gate-frozen` on pass
- `.claude/agents/spec-implementer.md` — new: Sonnet; implements against frozen tests
- `.claude/hooks/enforce.ts` — add `findFrozenGateForPath` + wire into Write/Edit handler
- `.claude/hooks/enforce.test.ts` — 4 fixture cases for frozen-gate behaviour
- `.claude/skills/do/SKILL.md` — Step 2.5 rewrite + Step 10 `escalated` variant
- `.claude/settings.json` — permission rules allowing Edit/Write on `.claude/hooks/**`

## Decisions

1. **Model family pairing** — tester=Sonnet, judge=Opus, implementer=Sonnet. Opus for judge because it is the single most leveraged LLM call in the flow; different family from Sonnet-based tester buys meaningful independence. Cost overhead ≈1.6× Sonnet-per-spec baseline plus up to 3× Opus judge calls (capped).

2. **Judge feedback loop** — bounded 3 retries. `tester-review.md` is appended to the tester's handoff as a revision brief. Judge only criticizes; never proposes tests. 3-strike → `blocker.md` + exit `escalated`.

3. **Enforcement (three layers)** — (a) agent frontmatter `tools:` allowlist is the coarse outer gate (judge has no Bash and no Edit); (b) pre-tool-use hook reads every active spec's `gate:` frontmatter and blocks Write/Edit when a matching `.gate-frozen` sentinel exists; (c) prompt preamble in agent body makes the boundary LLM-internal. Layers are defence-in-depth; a single failure should not be catastrophic.

4. **Escalation mechanics** — `blocker.md` is a structured handoff: status, judge diagnosis, attempt history, resume-paths menu. New exit status `escalated` is distinct from `paused` (which means "implementer shipped, CI red"). Resuming via `/do <slug>` detects filesystem state and jumps to the right restart point. Worktree + branch preserved.

5. **Writeup escape hatch** — for `kind: writeup`, the dispatch chain is tester → implementer. No judge, no `.gate-frozen`. Rationale: the judge's rubric is calibrated for test-coverage intent, not prose quality; a prose-quality judge is a separable future spec.

6. **Orchestration locus** — the main `/do` session orchestrates. No new orchestrator subagent. State transitions are filesystem-observable (tester output, `tester-review.md`, `.gate-frozen`, `blocker.md`), so the main session's loop is a thin dispatcher rather than a stateful process.

## Out of scope

- Eval-on-content for writeups (prose-quality judge is an orthogonal future spec).
- Model-family auto-selection (fixed to Sonnet/Opus for now).
- A dedicated orchestrator subagent (rejected — filesystem state suffices; would add a hop without separation benefit).
- Deprecation notice for the single-subagent pattern in today's `/do` Step 2.5 (will happen organically on the next `/do` invocation after this PR merges — no migration code needed).
