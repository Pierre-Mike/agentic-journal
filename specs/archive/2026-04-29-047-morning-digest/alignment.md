---
created: 2026-04-28
status: confirmed
confidence: high
intent_hash: 5041f66c4180
---

## Goal

Add a recurring scheduled agent that scans overnight `/do-auto` outcomes and posts a daily morning digest summarizing what shipped, what stalled, and what needs human attention. The final piece of the auto-pilot loop.

## Big Picture

The digest agent runs every morning (9am via the existing `/schedule` skill). It scans three sources and produces a 3-row digest:

```
Sources                                   Digest row
─────────────────────────────────────────────────────────────────
specs/archive/YYYY-MM-DD-*/ (last 24h) →  ✅ MERGED   (count + list)
specs/active/*/ (status: active)       →  ⏸ PAUSED    (count + reason)
.agentic/last-alignment.md              →  ❓ NEEDS-HUMAN (intent + why)
   if status: needs-human

Output: .agentic/digest/YYYY-MM-DD.md  (gitignored, durable history)
       + PushNotification (timely awareness)
```

## Straightforward Details

- New skill: `.claude/skills/morning-digest/SKILL.md` — routine entry point
- New script: `scripts/morning-digest.ts` — scan + format logic
- Gate: `scripts/smoke-morning-digest.ts` — fixture that creates a synthetic state (1 archived spec, 1 active with judge-rejection, 1 needs-human mailbox) and asserts the digest output has 3 correct rows
- Output path: `.agentic/digest/YYYY-MM-DD.md` (gitignore)
- Cadence: 9am daily (the user wires up `/schedule` themselves; the skill handles the actual digest creation)
- Sources of "PAUSED" reason (in priority order):
  1. `specs/active/<id>/ci-failure.md` exists → CI red
  2. `specs/active/<id>/tester-review-*.md` with `## ESCALATION` header → judge rejection
  3. `specs/active/<id>/replan-escalation.md` exists → replan escalation
  4. otherwise → "in progress (no escalation)"

## Non-obvious Decisions

**D1 — Skill or pure script?**
⭐ Skill `/morning-digest`. Future-proof for evolution (add more sources, smarter summaries). The skill body is light; most logic is in `scripts/morning-digest.ts`.
❌ Pure script. Harder to evolve, no slash-command discoverability.

**D2 — Notification mechanism?**
⭐ Both: file-write to `.agentic/digest/YYYY-MM-DD.md` (durable, scannable history) AND PushNotification at the end of the routine. The file is the source of truth.
❌ Stdout only — relies on user being at terminal at 9am.

**D3 — Multiple needs-human items?**
The `.agentic/last-alignment.md` mailbox is single-slot (only the latest intent). For now: 1 mailbox → at most 1 ❓ row. Future evolution can add `.agentic/digest/queue/` for multiple in-flight intents. Not in scope for spec 047.

**D4 — Scheduling mechanism?**
⭐ Use the existing `/schedule` skill (cron-style). The morning-digest skill body documents how to wire it up: `claude /schedule "/morning-digest" --cron "0 9 * * *"`. Don't reinvent the cron layer.
❌ Custom cron entry. Tight coupling to user's machine, hard to migrate.
