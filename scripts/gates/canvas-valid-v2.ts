/**
 * Smoke gate for spec 017: validates docs/agentic-workflow.canvas (v2).
 *
 * RED STUB — to be implemented in task 1. Exits non-zero to keep the spec RED
 * until the v2 acceptance criteria are encoded here.
 *
 * Checks (target):
 *  - File exists
 *  - Parses as JSON
 *  - Top-level object has `nodes` and `edges` arrays
 *  - Total node count between 20 and 30
 *  - Three top-level groups: "Forward loop", "Feedback loop", "Guardrails",
 *    with fills #cce5ff, #e0d4f7, #ffd6d6 respectively
 *  - Exactly 5 file-type nodes pointing to named repo paths
 *  - Exactly 1 link node to the PR list
 *  - ≥ 3 dotted-red guardrail edges
 *
 * Exits 0 on pass, 1 on fail.
 */

console.error("✖ canvas-valid-v2: RED stub — v2 acceptance criteria not yet encoded");
process.exit(1);
