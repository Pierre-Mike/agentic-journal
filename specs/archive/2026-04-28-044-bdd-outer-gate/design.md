# Design — BDD outer acceptance gate

## Approach

Repurpose the existing `gate:` field in `proposal.md` frontmatter as the **outer gate** (BDD acceptance test scoped to `alignment.md`). For `kind: code` specs, this becomes a distinct layer from per-slice gates:

- **Outer gate** (proposal-level `gate:`): tests the spec's integrated behavior
- **Per-slice gates** (per-task `gate:` in `tasks.md`): test individual slice boundaries

Flow:
1. `spec-tester` scaffolds outer gate at Step 5 for `kind: code` (currently skipped)
2. `spec-judge` reviews outer gate against `alignment.md` at scaffold time
3. Per-slice TDD loop continues unchanged (slice N RED → judge → GREEN → refactor)
4. `spec:complete` verifies BOTH outer gate AND all per-slice gates before archive

## Files touched

- `.claude/skills/do/SKILL.md` — Step 5: document that spec-tester scaffolds outer gate for kind:code; Step 7: note spec-complete enforces outer gate
- `.claude/agents/spec-tester.md` — scaffold outer gate at Step 5 for kind:code (update 5c section)
- `.claude/agents/spec-judge.md` — explicitly review outer gate against `alignment.md` (new section at start of Scaffold mode)
- `scripts/spec-complete.ts` — verify outer gate before archive (add check after frozen-slice validation)
- `scripts/check-outer-gate-flow.ts` — the gate itself (RED validator)
- `specs/constitution.md` §4 — document outer/inner gate split (new subsection)

## Decisions

**D1 — Reuse `gate:` vs new field**
Reuse. The frontmatter `gate:` already declares the spec-level gate; underused for kind:code today. No schema churn.

**D2 — Judge reviews outer gate**
Yes. Outer gate is the integration check; most expensive to get wrong. Judge reviews at scaffold time using `alignment.md`.

**D3 — Enforcement timing**
At `spec:complete` only. Outer gate must be GREEN before archive. If RED, spec stays active.

## Out of scope

- Retroactive outer gates for archived specs (they didn't have alignment.md)
- Changing per-slice gate mechanics (those remain unchanged)
- Auto-generating outer gate from per-slice gates (outer gate is manually authored, BDD-style)
