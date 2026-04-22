# Design

## Approach

One-file edit to `.claude/skills/do/SKILL.md` Step 2.5:

1. Update the dispatch-chain fenced block so `code` alone maps to
   `tester → judge (retry cap 3) → implementer`, and
   `rule | workflow | writeup` maps to `tester → implementer (skip judge,
   skip .gate-frozen)`.
2. Update the main-session pseudocode so the skip-judge branch is guarded by
   `kind !== "code"` (previously `kind === "writeup"`). The body of that
   branch is unchanged: dispatch tester, await, dispatch implementer, await,
   return.

The gate script `scripts/smoke-do-dispatch-by-kind.ts` reads SKILL.md and
asserts both the table line and the pseudocode guard. It exits 0 on pass,
1 on any miss.

## Files touched

- `.claude/skills/do/SKILL.md` — Step 2.5 dispatch-chain table + pseudocode guard
- `scripts/smoke-do-dispatch-by-kind.ts` — new gate artifact (assertions)

## Decisions

- **Guard form `kind !== "code"` (not an explicit `["rule","workflow","writeup"]`
  list)** — future-proof against adding a fifth non-code kind, and matches
  the binary "is this code? then judge, else skip" semantics of the change.
- **Role summary table kept as-is** — no row in that table references kind,
  so nothing to update there.
- **No changes to `.claude/agents/*.md`** — the three role files are correct;
  only the dispatcher changes.
- **No migration** — in-flight specs already dispatched on the old rule
  complete under the old rule; new specs use the new rule from the next
  `/do` invocation.

## Risks

- **Risk**: a reader of the old pseudocode assumes writeup still has its own
  named branch.
  **Mitigation**: keep the prose in Step 2.5 that explains *why* code is
  special (self-collusion gate matters when one agent writes both test and
  production code); the new guard makes the rationale the rule.

## Out of scope

- Changing `.gate-frozen` hook logic in `.claude/hooks.ts`.
- Editing any `.claude/agents/*.md` file.
- Re-running archived specs under the new dispatch.
