---
created: 2026-04-28T00:00:00Z
status: confirmed
confidence: high
intent_hash: a1b2c3d4e5f6
---

## Goal

The `align` skill must persist its output to a durable file so that the alignment survives context resets and serves as the canonical intent source for `spec-tester`, `spec-judge`, and a future auto-pilot.

## Big Picture

Today: `align` is conversation-only. `spec-tester` receives the alignment via verbatim copy-paste in the Agent dispatch prompt from the main session. Lossy on compaction.

Future:
```
align skill ─writes─→ .agentic/last-alignment.md  (mailbox, gitignored)
                              │
                              ↓ (read by /do at scaffold time)
              specs/active/<id>-<slug>/alignment.md  (committed)
                              │
                              ↓ (read by)
        spec-tester, spec-judge, future auto-pilot agents
```

## Straightforward Details

- Mailbox path: `.agentic/last-alignment.md` (repo root, gitignored, single-slot — overwritten on each align run)
- Spec-folder path: `specs/active/<id>-<slug>/alignment.md` (committed, archives with spec)
- File format: YAML frontmatter + 4 markdown sections matching align's 4 layers (Goal / Big Picture / Straightforward Details / Non-obvious Decisions)
- Required frontmatter keys: `created` (ISO 8601 date), `status` (`confirmed` | `needs-human`), `confidence` (`high` | `low`), `intent_hash` (first 12 hex chars of sha256 of the original user intent string)

## Non-obvious Decisions

**D1 — Mailbox vs direct-write to spec folder.** ⭐ Mailbox: align is decoupled from /do internals; align doesn't need to know the spec ID/slug at write time. ❌ Direct write would force align to coordinate with the ID allocator.

**D2 — Add `confidence` field today.** ⭐ Add now even though /do today always writes `high`. Future /do-auto (spec 4) needs it; cheap now, schema-breaking to add later.

**D3 — `status` is binary: `confirmed` | `needs-human`.** ⭐ Two states cover today's flow + the future ambiguity gate. ❌ A third `draft` state adds no behavior.
