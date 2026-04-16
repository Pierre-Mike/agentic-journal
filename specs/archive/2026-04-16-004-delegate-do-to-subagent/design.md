# Design

## Approach

Skill-text edit plus a smoke gate that locks the required structure in. The smoke greps `.claude/skills/do/SKILL.md` for three anchors: the new Step 2.5 title, the `run_in_background: true` payload keyword, and the delegation rule. Cheap, deterministic, exactly matches the acceptance criteria.

## Files touched

- `.claude/skills/do/SKILL.md` — insert Step 2.5 Delegate; prefix Steps 3–10 with "Executed by background subagent"; append delegation rule
- `scripts/smoke-do-delegation.ts` — new gate artifact; greps SKILL.md for required anchors

## Decisions

- **`general-purpose` subagent, no custom agent yet** — ships in one edit, zero new files beyond the gate. Custom `do-worker` deferred until the pattern proves durable (5–10 real dispatches).
- **Inline Steps 3–10 in the handoff prompt, don't re-invoke `/do`** — avoids nested align; subagent has no prior context and no user. Procedure is short enough to paste.
- **Escalation thresholds unchanged** — the existing "3x verify fail / axiom breach / CI red" triggers already cover the situations where the subagent needs the user back. Adding more triggers would produce chatty escalation.
- **`run_in_background: true`** — main session returns immediately after dispatch. Completion notification is the only re-entry point. User may interrupt if impatient, but there's no polling.
- **Gate is string-grep, not runtime** — SKILL.md is consumed by Claude's skill loader, not executed. A grep smoke is the closest thing to a lint rule for skill content.

## Out of scope

- A `do-worker` custom agent definition
- Changes to the align skill
- Any refactor of Steps 3–10 themselves
- Metrics / telemetry for subagent dispatches
