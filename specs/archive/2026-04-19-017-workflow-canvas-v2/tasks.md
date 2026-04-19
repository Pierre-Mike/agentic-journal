# Tasks

- [x] 1. Author the v2 smoke gate `scripts/gates/canvas-valid-v2.ts` —
      modeled on `scripts/gates/canvas-valid.ts`. Asserts: file exists, parses
      as JSON, top-level has `nodes` + `edges` arrays, total node count between
      20 and 30, three groups labeled "Forward loop" / "Feedback loop" /
      "Guardrails" with the documented fills, exactly 5 file-type nodes
      pointing to the named repo paths, exactly 1 link node to the PR list,
      ≥ 3 dotted-red guardrail edges.
  - agent: main
  - depends: []
  - file_targets: [scripts/gates/canvas-valid-v2.ts]
  - boundary: [scripts/gates/canvas-valid-v2.ts]
- [x] 2. Generate the v2 canvas via the `canvas-generator-v2` skill — assemble
      the structural spec (Forward / Feedback / Guardrails groups, ~25 nodes,
      labeled edges, 5 file nodes, 1 link node) and write
      `docs/agentic-workflow.canvas`. Verify the 5 file-node paths exist before
      generation.
  - agent: main
  - depends: [1]
  - file_targets: [docs/agentic-workflow.canvas]
  - boundary: [docs/agentic-workflow.canvas]
- [x] 3. Validate the generated canvas against the gate — run
      `bun scripts/gates/canvas-valid-v2.ts` and `bun run tasks:verify`.
      Re-run task 2 if any assertion fails.
  - agent: main
  - depends: [2]
  - file_targets: [docs/agentic-workflow.canvas]
  - boundary: [docs/agentic-workflow.canvas]
