---
id: 017-workflow-canvas-v2
title: Workflow canvas v2 — full agentic loop with guardrails
status: active
kind: workflow
gate: scripts/gates/canvas-valid-v2.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on: [005-workflow-canvas, 016-red-commit-gate]
supersedes: 005-workflow-canvas
---

## Intent

A new contributor opening this repo must trace the complete idea→spec→work→ship→retrospective loop from a single canvas, including every guardrail (RED commits, pre-commit hooks, CI gates, auto-merge, post-merge sync), so the agentic workflow becomes self-documenting rather than tribal knowledge. This replaces the v1 canvas (spec 005) which predates spec 016's RED-bypass and several recent guardrails.

## Constraints

- Use the `canvas-generator-v2` skill (deterministic Python layout engine); no hand-authored JSON layout.
- Output must be valid JSON Canvas that opens cleanly in Obsidian without error.
- Total nodes between 20 and 30 (kept readable; pedagogical density).
- No overlapping nodes (canvas-generator-v2 guarantees this when used correctly).
- Three top-level group nodes — Forward / Feedback / Guardrails — with distinct fills:
  - Forward: blue `#cce5ff`
  - Feedback: purple `#e0d4f7`
  - Guardrails: red `#ffd6d6`
- File-type nodes filled yellow `#fff4b3`.
- Edge color discipline: solid blue (forward), solid purple (feedback), dotted red (guardrail→stage).
- Exactly 5 file-type nodes (clickable navigation cap): `lefthook.yml`, `scripts/red-commit-gate.ts`, `scripts/trace-scan.ts`, `.claude/skills/do/SKILL.md`, `.claude/skills/retro/SKILL.md`.
- Exactly 1 link node to `https://github.com/Pierre-Mike/agentic-journal/pulls`.
- Non-goal: any code changes beyond the canvas file; modifying the canvas-generator-v2 skill itself; documentation pages other than the canvas.

## Acceptance criteria

- [ ] `docs/agentic-workflow.canvas` is valid JSON Canvas (opens in Obsidian without error).
- [ ] Total nodes between 20 and 30.
- [ ] Three top-level group nodes — "Forward loop", "Feedback loop", "Guardrails" — each with the documented fill color.
- [ ] All forward stages from the inventory are present and connected by solid-blue edges in order.
- [ ] Feedback loop closes: edge from `improvement spec` back to `/do`.
- [ ] Guardrail nodes have red-colored edges to the stages they gate (≥ 3 such annotations including pre-commit→RED commit, pre-commit→work loop, CI→auto-merge). The "dotted" styling intent is conveyed by color discipline; the canvas-generator-v2 layout engine does not propagate `styleAttributes.pathfinder`.
- [ ] Exactly 5 file-type nodes pointing to existing repo files: `lefthook.yml`, `scripts/red-commit-gate.ts`, `scripts/trace-scan.ts`, `.claude/skills/do/SKILL.md`, `.claude/skills/retro/SKILL.md`.
- [ ] Exactly 1 link node to `https://github.com/Pierre-Mike/agentic-journal/pulls`.
- [ ] No overlapping nodes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for 017-workflow-canvas-v2.
- [ ] `bun scripts/gates/canvas-valid-v2.ts` exits 0 against the generated canvas.

(Note: `bun run check` is currently broken on `main` due to unrelated missing `@playwright/test` type declarations; not a regression introduced by this spec.)

## Context

- Supersedes `005-workflow-canvas` (the v1 canvas, which predates spec 016's RED-bypass and several recent guardrails).
- Builds on `016-red-commit-gate` (spec 016 introduces the typecheck pre-commit hook RED-skip, which this canvas now documents). This spec is the first to dogfood that bypass in production.
- Uses the `canvas-generator-v2` skill's deterministic layout engine (replaces the older `canvas-generator` skill).
- `kind: workflow` chosen over `writeup` because the gate is a JSON canvas, not a markdown writeup with text sections — matching predecessor spec 005's pattern. A new gate script `scripts/gates/canvas-valid-v2.ts` (modeled on the v1 `canvas-valid.ts`) enforces the v2 acceptance criteria below.
- Related: `https://github.com/Pierre-Mike/agentic-journal/pulls`
