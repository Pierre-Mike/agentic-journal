---
id: 046-do-auto-headless
title: headless /do-auto + ambiguity gate
status: active
kind: workflow
gate: scripts/smoke-do-auto-flow.ts
created: 2026-04-28
owner: main
depends_on: [045-replan-hook]
supersedes: null
---

## Intent

Replace the human's interactive role in `/do` Step 1 (align) with a single-shot alignment.md authorship by the `auto-aligner` subagent plus an ambiguity gate that exits cleanly when intent can't be confidently extracted. Enables true auto-pilot: `claude -p --max-turns N "/do-auto <intent>"`.

## Constraints

- No TTY required — the auto-aligner writes `.agentic/last-alignment.md` single-shot without confirmation loops
- Ambiguity signals (low confidence) cause clean exit with `status: needs-human` in the mailbox; the morning digest (spec 5, next) surfaces it for human review
- Reuses the existing mailbox path (`.agentic/last-alignment.md`), validator (`scripts/check-alignment-mailbox.ts`), and schema from spec 043
- Retains `/do`'s interactive `align` flow unchanged — `/do-auto` is a separate skill
- Non-goals: replacing the spec-tester, spec-judge, or spec-implementer — those steps (3-10) are preserved as-is

## Acceptance criteria

- [ ] `scripts/smoke-do-auto-flow.ts` gate passes: (a) high-confidence alignment.md → `/do-auto` proceeds, (b) low-confidence alignment.md → `/do-auto` exits cleanly without opening a worktree
- [ ] `.claude/agents/auto-aligner.md` exists with scoped permissions (Write: `.agentic/last-alignment.md`, `.agentic/last-intent.txt` only)
- [ ] `.claude/skills/do-auto/SKILL.md` exists with dispatcher logic (spawn auto-aligner → read mailbox → branch on confidence)
- [ ] `specs/constitution.md` documents auto-pilot mode (auto-aligner role + ambiguity gate semantics)

## Context

- Spec 043 introduced `.agentic/last-alignment.md` as the mailbox for alignment frontmatter + 4-section body
- Spec 045 introduced the spec-replanner as an example of a scoped subagent (constrained Read/Write paths, deterministic scope guard)
- Spec 5 (morning digest, not yet shipped) will read `.agentic/last-alignment.md` with `status: needs-human` to surface "needs-human" rows
