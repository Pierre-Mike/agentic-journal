---
id: 047-morning-digest
title: morning digest agent
status: active
kind: workflow
gate: scripts/smoke-morning-digest.ts
created: 2026-04-28
owner: main
depends_on:
  - 046-do-auto-headless
supersedes: null
---

## Intent

Add a recurring scheduled agent that scans overnight `/do-auto` outcomes and posts a daily morning digest summarizing what shipped (✅ MERGED), what stalled (⏸ PAUSED), and what needs human attention (❓ NEEDS-HUMAN). Closes the auto-pilot loop by providing a single daily scan point instead of requiring manual PR/spec/mailbox inspection.

## Constraints

- Digest runs via the existing `/schedule` skill (9am daily cron)
- Sources: archived specs (last 24h), active specs (with reason heuristic), `.agentic/last-alignment.md` (needs-human only)
- Output: `.agentic/digest/YYYY-MM-DD.md` (gitignored, durable history)
- No PushNotification in MVP — file-write only
- Single mailbox slot (1 ❓ row max per digest)
- PAUSED reason priority: ci-failure > judge rejection > replan-escalation > in-progress

## Acceptance criteria

- [ ] `scripts/smoke-morning-digest.ts` passes (fixture with 1 archived, 1 paused, 1 needs-human)
- [ ] `scripts/morning-digest.ts` scans archive/active/mailbox and writes `.agentic/digest/<today>.md`
- [ ] `.gitignore` covers `.agentic/digest/`
- [ ] `.claude/skills/morning-digest/SKILL.md` documents how to wire `/schedule`
- [ ] `specs/constitution.md` documents digest pillar

## Context

- Depends on spec 046 (do-auto-headless) for the `.agentic/last-alignment.md` mailbox schema
- Spec 043 established the alignment mailbox contract (`check-alignment-mailbox.ts`)
- Digest agent is the final spec (5 of 5) in the auto-pilot roadmap
