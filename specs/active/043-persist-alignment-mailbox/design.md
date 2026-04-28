# Design — Persist alignment.md mailbox

## Approach

Introduce a two-stage persistence model:
1. `align` skill writes to `.agentic/last-alignment.md` (mailbox, gitignored) at the end of its interview flow
2. `/do` skill reads the mailbox in Step 5 and copies it to `specs/active/<id>-<slug>/alignment.md` (committed)

The gate validator (`scripts/check-alignment-mailbox.ts`) verifies schema compliance: frontmatter with 4 required keys + 4 required H2 sections.

## Files touched

- `.gitignore` — ensure `.agentic/` is covered (already done in preflight)
- `scripts/check-alignment-mailbox.ts` — new gate validator
- `.claude/skills/align/SKILL.md` — add final "write mailbox" step
- `.claude/skills/do/SKILL.md` — Step 5 consumes mailbox and copies to spec folder
- `specs/active/043-persist-alignment-mailbox/alignment.md` — self-demonstration of the schema

## Decisions

**Mailbox format:** YAML frontmatter + markdown body. Chose YAML over JSON to keep the file human-readable and editable in any text editor. The 4-section structure mirrors align's layers exactly.

**Single-slot mailbox:** Overwrite `.agentic/last-alignment.md` on each align run. No versioning, no rotation. The spec folder copy is the archival copy; the mailbox is ephemeral.

**Frontmatter schema:** 4 keys are sufficient for today's flow + future auto-pilot. `created` and `intent_hash` provide audit trail. `status` and `confidence` gate ambiguity handling in future specs.

## Out of scope

- **`/do` skill mailbox consumption** — Task 3 (editing `.claude/skills/do/SKILL.md` Step 5) was blocked by Claude Code's internal permission guard on `.claude/skills/` paths. The Edit and Write tools were denied. The schema and validator are complete; `/do` integration is deferred to a follow-up session or manual edit. The intended change: after Step 5a writes `proposal.md`, copy `.agentic/last-alignment.md` to `specs/active/<id>-<slug>/alignment.md` before proceeding to Step 5b.
- This spec demonstrates the alignment.md schema and validates it via the gate. Align skill was updated to document the mailbox write step. Actual end-to-end execution (align writes → do consumes) is deferred.
