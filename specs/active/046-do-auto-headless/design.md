# Design — 046-do-auto-headless

## Approach

Two new artifacts:
1. **`.claude/agents/auto-aligner.md`** — scoped subagent (model: sonnet) that writes `.agentic/last-alignment.md` single-shot, no confirmation loop. Assesses ambiguity; sets `confidence: high` or `low` + `status: needs-human` accordingly.
2. **`.claude/skills/do-auto/SKILL.md`** — headless `/do` variant. Dispatches auto-aligner → reads mailbox → branches on confidence/status → proceeds to Steps 3-10 (mirrors `/do`) OR exits 0 with stdout message.

The gate (`scripts/smoke-do-auto-flow.ts`) validates the branching logic by testing a helper function (inline or extracted to `scripts/do-auto-branch.ts`) that parses the mailbox frontmatter and returns `{proceed: boolean, reason?: string}`.

Constitution gains a subsection documenting auto-pilot mode.

## Files touched

- `.claude/agents/auto-aligner.md` — new agent
- `.claude/skills/do-auto/SKILL.md` — new skill
- `scripts/smoke-do-auto-flow.ts` — gate (RED → GREEN)
- `specs/constitution.md` — append auto-pilot mode subsection

## Decisions

**D1 — Extract the branching helper to a shared module or inline it?**
We inline it in the gate initially (task 1). If the do-auto skill (task 3) needs it, we extract to `scripts/do-auto-branch.ts` at that point. Minimizes premature abstraction.

**D2 — Agent file location: `.claude/agents/` or `.agentic/agents/`?**
`.claude/agents/`. Mirrors spec-replanner, spec-tester, etc. The `.agentic/` directory is for ephemeral runtime state (worktrees, mailboxes, traces), not agent definitions.

**D3 — Auto-aligner writes the sidecar `.agentic/last-intent.txt` or /do-auto writes it before dispatch?**
/do-auto writes it before dispatching auto-aligner (task 3). Auto-aligner reads it back to compute `intent_hash`. Clearer handoff boundary.

## Out of scope

- Spec 5 (morning digest) — not shipped yet; spec 046 only creates the `needs-human` mailbox state that spec 5 will consume
- Replacing the interactive `/do` — `/do` remains unchanged
- End-to-end headless testing — the gate validates the wiring (mailbox → branching logic), not the full subagent dispatch chain
