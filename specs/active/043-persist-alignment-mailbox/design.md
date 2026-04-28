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

- Align skill does not yet write the mailbox (that's Task 2)
- `/do` skill does not yet consume the mailbox (that's Task 3)
- This spec only scaffolds the schema and validator; the skills are edited but not yet executed in a live flow
