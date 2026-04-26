// @no-test: smoke script — tested by bun run tasks:verify
/**
 * Gate for spec 036-refactor-pass-after-green.
 *
 * RED stub — exits 1 until the implementer adds the Step 6.5 section to
 * .claude/agents/spec-implementer.md.
 *
 * Assertions to add when GREEN:
 *   1. .claude/agents/spec-implementer.md contains a heading matching
 *      /step 6\.5/i (case-insensitive, e.g. "### Step 6.5 — Refactor pass")
 *   2. The Step 6.5 section body contains a `kind: code` gate condition
 *      (text matching /kind.*code/i or /code.*kind/i)
 *   3. The Step 6.5 section body contains a scope instruction referencing
 *      file_targets (text matching /file_targets/i)
 *   4. The Step 6.5 section body contains a revert-on-fail instruction
 *      (text matching /revert/i)
 *   5. The Step 6.5 section appears AFTER the Step 6 section in the file
 *      (ordinal position check)
 */

console.error("smoke-implementer-refactor: RED — spec 036 not yet implemented");
process.exit(1);
