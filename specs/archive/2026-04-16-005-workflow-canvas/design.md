# Design

## Approach

Use the `canvas-generator-v2` skill (deterministic layout engine) to produce the JSON Canvas. Provide the skill with node/edge/group structure derived from `AGENTS.md`'s workflow section. Write output to `docs/agentic-workflow.canvas`. Validate via a smoke script at `scripts/gates/canvas-valid.ts` that parses JSON and checks required shape (nodes array, edges array, both groups present).

## Files touched

- `docs/agentic-workflow.canvas` — new file, the canvas artifact itself
- `scripts/gates/canvas-valid.ts` — new file, smoke script serving as the gate

## Decisions

- **File location: `docs/agentic-workflow.canvas`** — chosen because `docs/` exists, is not protected, is the right semantic home for explanatory artifacts, and has no spec gate blocking later edits.
- **Level of detail: medium (~15 nodes)** — one node per named step in the AGENTS.md workflow section; internal sub-steps (align's 4 layers, worktree scripts) folded into their parent step; both loops visible plus 2-3 invariant callouts.
- **Spec kind: `workflow` (not `writeup`)** — the `writeup` gate in `scripts/gates/writeup.ts` strictly validates markdown required sections via regex, which a JSON Canvas cannot satisfy. `workflow` with a smoke script is the cleanest deterministic fit per constitution §2, §4.

## Risks

- Canvas grows stale as workflow evolves. Mitigation: any future workflow change requires a spec; that spec's tasks can include updating this canvas.

## Out of scope

- Interactive web version
- Companion blog post
- Canvas for `/retro` internals in isolation (it's folded into this one)
