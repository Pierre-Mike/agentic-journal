# Design

## Approach

Author `docs/auto-pilot-loop.canvas` directly as Obsidian JSON Canvas. Schema reference: `docs/agentic-workflow.canvas` (spec 036). No generator script — the implementer writes the JSON manually following the node/edge spec below.

## Files touched

- `docs/auto-pilot-loop.canvas` — the canvas artifact (stub → full demo)

## Canvas layout

Three swim-lane groups (left-to-right):

| Column | x     | Contents                                         |
|--------|-------|--------------------------------------------------|
| 0      | 0     | `/do-auto` node (blue, Trigger group)            |
| 1      | 320   | `auto-aligner` + `last-alignment.md` (purple, Judgment gate group) |
| 2a     | 640   | `/do Steps 3-10` (green, Outcomes group)         |
| 2b     | 640   | `/morning-digest` (amber, Outcomes group)        |
| 3a     | 960   | `digest/YYYY-MM-DD.md` (amber, Outcomes group)   |

Nodes within a column are spaced 200px vertically (y offset).

## Edge labels

| From               | To                  | Label           |
|--------------------|---------------------|-----------------|
| /do-auto           | auto-aligner        | `intent`        |
| auto-aligner       | last-alignment.md   | `dispatch`      |
| last-alignment.md  | /do Steps 3-10      | `confirmed+high` |
| last-alignment.md  | /morning-digest     | `needs-human`   |
| /do Steps 3-10     | /morning-digest     | `scaffold+PR`   |
| /morning-digest    | digest/YYYY-MM-DD.md | `MERGED row` / `NEEDS-HUMAN row` |

## Decisions

- **kind: workflow (not writeup)** — the gate artifact is JSON Canvas. The `checkWriteup` gate checker requires markdown headings, which cannot be embedded in valid JSON. A `kind: workflow` smoke script correctly validates JSON structure and required content. Pattern established by spec 036.
- **Gate script not canvas file** — gate is `scripts/gates/auto-pilot-loop-canvas-valid.ts`. The canvas file itself is the deliverable; the script is the verifier.
- **No canvas generator** — no `canvas-generator-v2` skill in repo. Direct JSON authoring is faster and `docs/agentic-workflow.canvas` provides a sufficient schema reference.
- **docs/ directory** — consistent with `docs/agentic-workflow.canvas`.

## Risks

- Color convention drift from `agentic-workflow.canvas` — implementer must verify color codes match existing canvas before submitting.

## Out of scope

- Blog post or MDX embedding of canvas
- Interactive navigation
- Skill for generating canvas JSON programmatically
