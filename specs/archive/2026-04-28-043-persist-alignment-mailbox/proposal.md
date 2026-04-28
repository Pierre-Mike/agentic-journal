---
id: 043-persist-alignment-mailbox
title: Persist alignment.md mailbox
status: archived
kind: workflow
gate: scripts/check-alignment-mailbox.ts
created: 2026-04-28T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-28'
---

## Intent

The `align` skill must persist its output to a durable file so that the alignment survives context resets and serves as the canonical intent source for `spec-tester`, `spec-judge`, and a future auto-pilot.

Today, `align` is conversation-only. `spec-tester` receives the alignment via verbatim copy-paste in the Agent dispatch prompt from the main session, which is lossy on compaction. This spec introduces a "mailbox" pattern: `align` writes to `.agentic/last-alignment.md` (gitignored, single-slot), and `/do` copies that file into `specs/active/<id>-<slug>/alignment.md` (committed, archived with the spec) at scaffold time.

## Constraints

- Mailbox path: `.agentic/last-alignment.md` (repo root, gitignored, overwritten on each align run)
- Spec-folder path: `specs/active/<id>-<slug>/alignment.md` (committed, archives with spec)
- File format: YAML frontmatter + 4 markdown sections matching align's 4 layers (Goal / Big Picture / Straightforward Details / Non-obvious Decisions)
- Required frontmatter keys: `created` (ISO 8601 date), `status` (`confirmed` | `needs-human`), `confidence` (`high` | `low`), `intent_hash` (first 12 hex chars of sha256 of the original user intent string)
- `.agentic/` directory is gitignored (already covered by existing `.gitignore` entry)
- The gate is a TypeScript smoke check that validates frontmatter structure and section presence

## Acceptance criteria

- [ ] `scripts/check-alignment-mailbox.ts` exists and validates frontmatter + 4 H2 sections, exits 0 on valid, non-zero with stderr on invalid
- [ ] `.claude/skills/align/SKILL.md` documents the final "write mailbox" step
- [ ] `.claude/skills/do/SKILL.md` Step 5 consumes `.agentic/last-alignment.md` and copies it to `specs/active/<id>-<slug>/alignment.md`
- [ ] This spec's `alignment.md` demonstrates the schema

## Context

This is spec 1 of a 5-spec roadmap to auto-pilot `/do`. The mailbox decouples `align` from `/do` internals (align doesn't need to know the spec ID/slug at write time). Future specs will consume `alignment.md` for automated TDD dispatch and judging.
