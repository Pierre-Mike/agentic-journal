---
name: morning-digest
description: >
  Recurring scheduled agent that scans overnight /do-auto outcomes and posts a daily morning
  digest summarizing what shipped (✅ MERGED), what stalled (⏸ PAUSED), and what needs human
  attention (❓ NEEDS-HUMAN). Run manually via /morning-digest or schedule via /schedule.
  Output: .agentic/digest/YYYY-MM-DD.md (gitignored, durable history).
---

## Core Principle

One daily scan of overnight auto-pilot outcomes. Three digest rows: MERGED (what shipped), PAUSED (what stalled + why), NEEDS-HUMAN (what requires review). Default output is file-only; no notifications in MVP.

## Preconditions

- Current directory is the repo root
- `.agentic/` directory exists (gitignored, holds runtime state)

No other preconditions. The script gracefully handles missing directories (no archived specs, no active specs, no mailbox).

## Workflow

### Step 1 — Invoke scan script

Run the digest generator:

```bash
bun scripts/agentic/morning-digest.ts
```

The script scans three sources:

1. **`specs/archive/`** — all directories matching `YYYY-MM-DD-*` created in the last 24h → ✅ MERGED row
2. **`specs/active/`** — all subdirectories, apply reason heuristic → ⏸ PAUSED row
3. **`.agentic/last-alignment.md`** — if exists and `status: needs-human` → ❓ NEEDS-HUMAN row

### Step 2 — Read output

The script writes to `.agentic/digest/YYYY-MM-DD.md` and prints the digest to stdout.

Example output:

```
Morning digest written to /path/to/.agentic/digest/2026-04-29.md

# Morning Digest — 2026-04-29

## ✅ MERGED (2)

- **042-auto-ci-triage**: Auto-triage CI failures (2026-04-28)
- **043-persist-alignment-mailbox**: Persist alignment mailbox (2026-04-28)

## ⏸ PAUSED (1)

- **044-spec-in-progress**: judge rejection

## ❓ NEEDS-HUMAN (1)

- **Intent**: Add a complex multi-step refactor across 5 modules
- **Reason**: ambiguous intent
```

### Step 3 — Review digest

Scan the 3 rows:

- **MERGED** — celebrate shipped specs
- **PAUSED** — triage the reason (CI red → fix tests; judge rejection → revise design; replan escalation → check diff)
- **NEEDS-HUMAN** — read `.agentic/last-alignment.md`, decide whether to run `/do` (interactive alignment) or refine intent for `/do-auto` retry

## PAUSED reason heuristic (priority order)

1. `specs/active/<id>/ci-failure.md` exists → "CI red"
2. `specs/active/<id>/tester-review-*.md` with `## ESCALATION` header → "judge rejection"
3. `specs/active/<id>/replan-escalation.md` exists → "replan escalation"
4. Otherwise → "in progress (no escalation)"

## Scheduling

Wire up the digest to run daily at 9am:

```bash
claude /schedule "/morning-digest" --cron "0 9 * * *"
```

The `/schedule` skill (from the Claude Code harness) handles cron execution. The `/morning-digest` skill body is stateless — each invocation is independent.

## Hard rules

- **Never mutate specs or worktrees.** The digest is read-only. Write permission is limited to `.agentic/digest/<date>.md`.
- **Gracefully handle missing sources.** Empty archive → "No specs merged in the last 24h." No active specs → "No active specs with escalations." No mailbox → "No intents awaiting human review."
- **Single mailbox slot.** `.agentic/last-alignment.md` is single-slot (spec 043/046 contract). The digest surfaces at most 1 NEEDS-HUMAN row. Future specs may add multi-slot queue support.
- **No PushNotification in MVP.** File output is the source of truth. Notifications can be added in a future spec without changing the core scan logic.

## When NOT to invoke

- Mid-day spot checks → just read `.agentic/digest/<today>.md` directly if it exists; no need to re-run
- Digest already ran today → the file is durable; re-running overwrites it (safe but redundant)
- Testing the digest logic → use `scripts/smoke/smoke-morning-digest.ts` (the gate) instead

## Relationship to /do-auto

`/do-auto` writes `.agentic/last-alignment.md` on `needs-human` outcomes (spec 046). The morning digest reads that mailbox and surfaces it in the ❓ NEEDS-HUMAN row. This closes the auto-pilot loop: overnight `/do-auto` runs → morning digest → human review.
