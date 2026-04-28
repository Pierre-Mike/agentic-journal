---
created: 2026-04-28T00:00:00Z
status: confirmed
confidence: high
intent_hash: 115909af05b1
---

## Goal

Replace the human's interactive role in `/do` with two automated mechanisms so the spec workflow can run from cron, retro findings, or queued issues — no TTY, no main-session Claude needed.

## Big Picture

Today: `/do` requires 4 layers of confirmations in `align` (Goal → Big Picture → Details → Decisions) plus 1 confirmation in Step 2 (spec fields). All require a TTY and a human. Cannot run from headless contexts.

Future: a NEW skill `/do-auto <intent>` that:
1. Spawns an `auto-aligner` subagent with the intent string
2. Auto-aligner writes `.agentic/last-alignment.md` single-shot using align's 4-section schema (Goal / Big Picture / Straightforward Details / Non-obvious Decisions) — no confirmation loop
3. Auto-aligner sets `confidence: high` if intent is clear, OR `confidence: low` + `status: needs-human` if the intent is ambiguous (and the auto-aligner exits without scaffolding anything)
4. If high confidence → `/do-auto` proceeds to Steps 3-10 (worktree, scaffold, slice loop, close, push, PR)
5. If low confidence → `/do-auto` exits 0; the alignment.md sits at the mailbox path with `status: needs-human`; the morning digest (spec 5) picks it up next AM

```
intent → auto-aligner → .agentic/last-alignment.md
                          │
                          ├─ confidence: high   → /do-auto runs Steps 3-10
                          └─ confidence: low    → exit 0, surfaces in digest
```

## Straightforward Details

- New skill: `.claude/skills/do-auto/SKILL.md` — mirrors `/do` Steps 3-10 but skips Step 1's interactive align and replaces Step 2's confirmation with the auto-aligner output
- New agent: `.claude/agents/auto-aligner.md` — model: sonnet, scoped to write `.agentic/last-alignment.md` only
- Headless invocation: `claude -p --max-turns 100 "/do-auto <intent>"`
- Mailbox reuse: same `.agentic/last-alignment.md` path that spec 1 introduced; same validator (`scripts/check-alignment-mailbox.ts`); same frontmatter schema
- Ambiguity signals (auto-aligner sets `status: needs-human`):
  - Intent doesn't name a concrete file/feature/path (e.g., "make it better")
  - Intent could imply 3+ different specs (e.g., "fix the auth flow" — which part?)
  - Intent contradicts repo conventions surfaced from `specs/constitution.md`
- /do-auto reads the mailbox after auto-aligner exits, checks `status` field, branches accordingly. If `needs-human`, exits 0 with a clear stdout line.

## Non-obvious Decisions

**D1 — Reuse the existing mailbox path or new one?**
⭐ Reuse `.agentic/last-alignment.md` (spec 1's path). Same schema, same validator. /do-auto adds a confidence-check branch.
❌ New `.agentic/auto-alignment.md` — duplicates schema + validator for no win.

**D2 — Auto-aligner model: sonnet or haiku?**
⭐ Sonnet. Ambiguity assessment requires judgment ("could this intent map to 3 different specs?"). Haiku is too brittle on the edge cases that matter most (false high-confidence on actually-ambiguous intents).
❌ Haiku — false negatives on ambiguity = expensive (a wrongly-scaffolded spec wastes 10+ minutes of slice work before failing the BDD outer gate from spec 044).

**D3 — How does /do-auto pass intent to auto-aligner?**
⭐ Verbatim string in handoff prompt + write `.agentic/last-intent.txt` (sidecar) so auto-aligner can compute `intent_hash` deterministically. /do-auto writes the sidecar file before dispatching; auto-aligner reads it back to hash. The hash is preserved in alignment.md frontmatter (`intent_hash`).
❌ Auto-aligner re-derives intent from /do-auto's prompt — fragile, cross-boundary.

**D4 — Where does /do-auto exit on low confidence?**
⭐ Before any worktree open or spec scaffold. Mailbox sits with `status: needs-human`; nothing else changes. The morning digest (spec 5, next) reads `.agentic/last-alignment.md` to surface "needs-human" rows.
❌ Open the worktree + scaffold but skip slice work — wastes a worktree slot, confusing for digest.

**D5 — `/do-auto` is a separate skill or extends `/do`?**
⭐ Separate skill `/do-auto`. Easier to invoke from headless. `/do` keeps interactive align unchanged. They share Steps 3-10 conceptually but the skill files are independent.
❌ Add a `--auto` flag to `/do` — slash commands don't take flags ergonomically; harder to discover.
