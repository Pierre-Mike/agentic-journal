---
created: 2026-04-29
status: confirmed
confidence: high
intent_hash: 9b3a2c0169f9
---

## Goal

Produce a visual Obsidian JSON Canvas file that demonstrates how the three new auto-pilot skills interlock: `/do-auto` (the headless entry point), `auto-aligner` (the single-shot judgment subagent), and `/morning-digest` (the feedback closer). The artifact belongs in `docs/` alongside the existing `agentic-workflow.canvas`, and serves as a reader-facing explanation of the overnight automation loop added in specs 046-047.

## Big Picture

The canvas maps one complete auto-pilot cycle: an intent arrives headless, the aligner judges it, the result either triggers the full `/do` pipeline or surfaces in the morning digest for human review.

```
[raw intent]
     |
     v
[/do-auto SKILL]──dispatch──>[auto-aligner AGENT]
                                      |
                        .agentic/last-alignment.md
                              /              \
              status:confirmed           status:needs-human
              confidence:high            (or confidence:low)
                    |                          |
              [/do Steps 3-10]         [morning-digest SKILL]
              worktree, scaffold,             |
              slice loop, PR          .agentic/digest/YYYY-MM-DD.md
                    |                          |
              merged spec              human reads digest, re-submits
                    |
              [morning-digest]──MERGED row
```

Canvas nodes group into three swim-lanes: Trigger, Judgment, and Outcomes. Edges carry labels matching the frontmatter keys (`status`, `confidence`).

## Straightforward Details

### File location and naming
- Target path: `docs/auto-pilot-loop.canvas`
- Format: Obsidian JSON Canvas (same schema as `docs/agentic-workflow.canvas`)
- Filename chosen to be self-describing; no collision with existing canvas

### Canvas content
- Node per component: `/do-auto`, `auto-aligner`, `last-alignment.md` (mailbox), `/do Steps 3-10`, `/morning-digest`, `digest/YYYY-MM-DD.md`
- Two group nodes: "Judgment gate" (wraps aligner + mailbox) and "Outcomes" (wraps the two branches)
- Edge labels: `intent`, `dispatch`, `confirmed+high`, `needs-human`, `scaffold+PR`, `MERGED row`, `NEEDS-HUMAN row`
- Color palette: blue for trigger, purple for judgment, green for success branch, amber for needs-human branch — consistent with existing canvas color conventions

### Spec structure
- `kind: writeup`
- Gate: `docs/auto-pilot-loop.canvas` (file must exist and be valid JSON with `nodes` and `edges` keys)
- No tasks.md required for writeup; single gate artifact
- `file_targets: [docs/auto-pilot-loop.canvas]`
- `depends_on: [046-do-auto-headless, 047-morning-digest]`

### Implementation approach
- Implementer writes canvas JSON directly (no canvas-generator-v2 skill exists in repo; `docs/agentic-workflow.canvas` is the format reference)
- Node positions: left-to-right layout, x increases 320px per column, nodes within a column spaced 200px vertically

## Non-obvious Decisions

### Decision: kind:writeup vs. kind:code

Recommended — `kind: writeup`. The deliverable is a static JSON artifact with no runtime behavior and no test harness. A writeup gate (file exists + valid JSON) is the correct verification level. A code spec would require a test file that validates canvas content, which is overengineered for a demo artifact.

Rejected: `kind: code` — would require a `*.test.ts` gate, slice-RED TDD, and a spec-judge review cycle. The artifact has no behavioral contract to test beyond structural validity.

### Decision: canvas-generator-v2 skill (not present in repo)

Recommended — generate canvas JSON directly in the implementation step. The implementer reads `docs/agentic-workflow.canvas` for schema reference and writes `docs/auto-pilot-loop.canvas` from scratch. This is faster and avoids a skill-scaffolding detour.

Rejected: scaffold canvas-generator-v2 first — adds a blocking dependency spec, slows delivery by at least one `/do` cycle, and is not required by the intent.

### Decision: target directory

Recommended — `docs/`. The only existing canvas file in the repo lives at `docs/agentic-workflow.canvas`. Placing the new canvas alongside it is the obvious convention.

Rejected: `content/posts/` — that path is for MDX blog posts (constitution section 6); canvas files are not posts.
