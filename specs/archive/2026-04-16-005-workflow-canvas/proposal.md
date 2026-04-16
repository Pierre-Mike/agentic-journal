---
id: 005-workflow-canvas
title: Canvas explaining the agentic workflow
status: archived
kind: workflow
gate: scripts/gates/canvas-valid.ts
created: 2026-04-16T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-16'
---

## Intent

Produce a visual Obsidian JSON Canvas at `docs/agentic-workflow.canvas` that diagrams this repo's agentic workflow — the forward loop (`/do`: align → worktree → RED spec → work → `spec:complete` → PR → merge → `sync`) and the feedback loop (`/retro`: scan traces + archive + merged PRs → author improvement spec via `/do`). A newcomer should grasp both loops at a glance without reading `AGENTS.md`.

## Constraints

- Single file: `docs/agentic-workflow.canvas`
- Format: Obsidian JSON Canvas v1 (top-level `nodes` array, `edges` array)
- Two named groups: "Forward loop", "Feedback loop"
- Left-to-right flow for the forward loop; feedback arc below
- Medium detail (~15 nodes) — one node per named step in `AGENTS.md` workflow section
- Colors: forward=blue (4), feedback=purple (5), invariants=red (1)
- Meta nodes: title, legend, invariant callouts ("main stays clean", "gate = verdict", "deterministic-first")
- Edges labeled where non-obvious (e.g., `RED→green`, `CI gates merge`)
- Text nodes only (self-contained, no external file references)

### Non-goals

- Interactive navigation
- Blog post version of the canvas
- Embedding the canvas in any MDX page
- Documenting internals beyond the top-level workflow steps

## Acceptance criteria

- [ ] `docs/agentic-workflow.canvas` exists
- [ ] File parses as valid JSON
- [ ] Top-level object contains `nodes` array and `edges` array
- [ ] Canvas contains both "Forward loop" and "Feedback loop" groups
- [ ] At least 12 nodes across the two loops plus meta
- [ ] `bun run tasks:verify` exits 0
- [ ] `bun run spec:lint` exits 0

## Context

First spec of `kind: workflow` whose gate is a deterministic smoke script validating a non-code artifact. Establishes the pattern for future diagram-as-artifact specs. Referenced by `AGENTS.md` workflow section as the visual companion.
