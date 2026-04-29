---
id: 048-auto-pilot-loop-canvas
title: Auto-pilot loop canvas demo
status: archived
kind: workflow
gate: scripts/gates/auto-pilot-loop-canvas-valid.ts
created: 2026-04-29T00:00:00.000Z
owner: main
depends_on:
  - 046-do-auto-headless
  - 047-morning-digest
supersedes: null
archived: '2026-04-29'
---

## Intent

Produce a visual Obsidian JSON Canvas at `docs/auto-pilot-loop.canvas` that demonstrates how the three auto-pilot skills interlock: `/do-auto` (headless entry point), `auto-aligner` (single-shot judgment subagent), and `/morning-digest` (feedback closer). The artifact lives in `docs/` alongside `agentic-workflow.canvas` and serves as a reader-facing explanation of the overnight automation loop added in specs 046-047.

## Constraints

- Single file: `docs/auto-pilot-loop.canvas`
- Format: Obsidian JSON Canvas (same schema as `docs/agentic-workflow.canvas`)
- Three swim-lane groups: "Trigger", "Judgment gate", "Outcomes"
- Named nodes per component: `/do-auto`, `auto-aligner`, `last-alignment.md`, `/do Steps 3-10`, `/morning-digest`, `digest/YYYY-MM-DD.md`
- Edge labels matching frontmatter keys: `intent`, `dispatch`, `confirmed+high`, `needs-human`, `scaffold+PR`, `MERGED row`, `NEEDS-HUMAN row`
- Color palette: blue for trigger, purple for judgment, green for success branch, amber for needs-human branch
- Left-to-right layout, x increases 320px per column, nodes within a column spaced 200px vertically
- No external file references (text/group nodes only)

### Non-goals

- Interactive navigation
- Blog post or MDX embedding of the canvas
- Documenting implementation internals beyond the top-level skill interactions

## Acceptance criteria

- [ ] `docs/auto-pilot-loop.canvas` exists
- [ ] File parses as valid JSON
- [ ] Top-level object contains `nodes` array and `edges` array
- [ ] Canvas contains all three swim-lane groups: "Trigger", "Judgment gate", "Outcomes"
- [ ] Canvas contains at least 8 nodes (6 component nodes + 2 group nodes minimum)
- [ ] Canvas contains at least 4 edges with labels
- [ ] `bun run tasks:verify` exits 0
- [ ] `bun run spec:lint` exits 0

## Context

Companion to specs 046-047. The existing `docs/agentic-workflow.canvas` (spec 036) established the JSON Canvas format and color conventions — this canvas extends the picture with the auto-pilot overlay. Gate pattern follows spec 036 (`scripts/gates/canvas-valid.ts`).

Note: `kind: workflow` is used (not `kind: writeup`) because the gate artifact is a JSON Canvas file — the `checkWriteup` gate checker expects markdown sections, which cannot be embedded in valid JSON. A workflow smoke script (`scripts/gates/auto-pilot-loop-canvas-valid.ts`) correctly validates JSON structure and content.
