# Design

## Approach

1. **New skill**: `.claude/skills/morning-digest/SKILL.md` — invoked by user or via `/schedule` to trigger digest generation
2. **Core logic**: `scripts/morning-digest.ts` — scans filesystem and writes digest
3. **Gate fixture**: `scripts/smoke-morning-digest.ts` — synthetic test state with 3 digest rows

## Files touched

### New files
- `.claude/skills/morning-digest/SKILL.md` — skill entry point
- `scripts/morning-digest.ts` — scan + format logic
- `scripts/smoke-morning-digest.ts` — gate fixture

### Edited files
- `.gitignore` — add `.agentic/digest/`
- `specs/constitution.md` — document digest pillar under §4

### Runtime artifacts (gitignored)
- `.agentic/digest/YYYY-MM-DD.md` — daily digest output

## Decisions

### D1 — Skill or pure script?
**Chosen**: Skill `/morning-digest`
**Rationale**: Future-proof for evolution (add more sources, smarter summaries). The skill body is light; most logic is in `scripts/morning-digest.ts`. Skill provides slash-command discoverability.

### D2 — Notification mechanism?
**Chosen**: File-write to `.agentic/digest/YYYY-MM-DD.md` (durable history). No PushNotification in MVP.
**Rationale**: File is source of truth. PushNotification can be added later without changing the core scan logic. MVP focuses on durable output.

### D3 — Multiple needs-human items?
**Chosen**: Single mailbox slot → at most 1 ❓ row per digest.
**Rationale**: `.agentic/last-alignment.md` is single-slot (spec 043/046 contract). Future evolution can add `.agentic/digest/queue/` for multiple in-flight intents. Not in scope for spec 047.

### D4 — Scheduling mechanism?
**Chosen**: Existing `/schedule` skill. Skill body documents: `claude /schedule "/morning-digest" --cron "0 9 * * *"`.
**Rationale**: Don't reinvent cron layer. Leverage existing infrastructure. User wires up manually.

### D5 — PAUSED reason priority
**Chosen**: ci-failure > judge rejection > replan-escalation > in-progress
**Rationale**: CI failure is most actionable (blocks merge). Judge rejection is next (needs design rethink). Replan escalation is softer (may auto-resolve). In-progress is default (no known blocker).

## Out of scope

- PushNotification integration (future enhancement)
- Multiple needs-human mailbox slots (future spec)
- Digest UI/dashboard (file output is MVP)
- Digest history scanning beyond current day (no analytics yet)
