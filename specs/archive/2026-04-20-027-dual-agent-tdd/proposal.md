---
id: 027-dual-agent-tdd
title: Dual-agent TDD with AI judge
status: archived
kind: workflow
gate: scripts/smoke-dual-agent-do.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 007-harness-self-improvement
  - 012-canary-skill-suite
supersedes: null
archived: '2026-04-20'
---

## Intent

Every spec 001–026 has a latent self-collusion failure mode: the single subagent that writes the RED gate also writes the implementation, so the tests encode the coder's mental model rather than user intent. Research (Code-A1 arxiv 2603.15611, AgentCoder arxiv 2312.13010) shows separating test-author from implementer yields 8–11pp pass@1 lift and eliminates the collusion window. This spec restructures `/do` into three subagent roles (spec-tester, spec-judge, spec-implementer) dispatched serially from the main session, with a `.gate-frozen` sentinel enforced by the pre-tool-use hook. Writeups skip the judge.

## Constraints

- Use native Claude Code `.claude/agents/*.md` mechanism (no inline prompts in SKILL.md).
- Tester and judge run on different model families (Sonnet vs Opus) for meaningful independence.
- Tool allowlists in agent frontmatter serve as the outer enforcement layer.
- `.gate-frozen` sentinel is the only file-level signal for "gate frozen".
- Retry cap of 3 matches existing Step 6 task-verify convention.
- New exit status `escalated` is distinct from `paused`.
- Writeups explicitly skip the judge (prose-quality rubric is a different spec).
- Single dispatch-chain code path with a `kind`-conditional; no parallel flow drift.

## Acceptance criteria

- [ ] `.claude/agents/spec-tester.md` exists with `name: spec-tester`, `model: sonnet`, `tools: [Read, Write, Edit, Bash, Grep, Glob]` (at minimum), and a prompt body that constrains writes to `specs/active/<id>/` + declared gate paths
- [ ] `.claude/agents/spec-judge.md` exists with `name: spec-judge`, `model: opus` (distinct from tester), `tools: [Read, Grep, Glob, Write]` (no Bash, no Edit), and a body containing all 4 rubric items verbatim
- [ ] `.claude/agents/spec-implementer.md` exists with `name: spec-implementer`, `model: sonnet`, full-tool allowlist, and a preamble stating gate paths are frozen
- [ ] `.claude/skills/do/SKILL.md` Step 2.5 dispatches spec-tester → spec-judge (loop, cap 3) → spec-implementer, with `kind: writeup` short-circuiting past the judge
- [ ] `.claude/hooks/enforce.ts` blocks Write/Edit on any path matching an active spec's `gate:` frontmatter when `.gate-frozen` sibling exists in that spec's folder
- [ ] `.claude/hooks/enforce.test.ts` covers (a) frozen + gate-match → block, (b) frozen + non-gate-match → allow, (c) non-frozen + gate-match → allow
- [ ] `scripts/smoke-dual-agent-do.ts` asserts the shape invariants: three agent files present with correct frontmatter; distinct models; judge body contains all 4 rubric items; SKILL.md references all three `subagent_type`s
- [ ] `scripts/smoke-dual-agent-do.test.ts` covers the gate's positive and negative cases via tmp fixtures
- [ ] `bun run tasks:verify` green

## Context

Research-backed retrospective. User requested "real TDD" after reviewing AgentCoder (arxiv 2312.13010), Code-A1 (arxiv 2603.15611), QAagent (AAAI 2025), and MIT Missing Semester 2026 agentic coding notes. This spec operationalizes the "tests frozen by an independent agent before code exists" pattern. Predecessor 007 (harness-self-improvement) framed the self-improvement theme; predecessor 012 (canary-skill-suite) established the pattern of locking skill shapes against fixture baselines, which this spec extends to subagent definitions.

## Deferred findings (carry-forward)

- main-red-after-merge gate (rule, carry-forward from 023)
- drift allowlist for `.claude/plans/**` (code, carry-forward from 023)
- align doesn't read project config (workflow, deferred from 025)
- parallel-/do stale-branch auto-retry (workflow, deferred from 025)
