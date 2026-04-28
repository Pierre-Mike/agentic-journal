# Design

## Approach

Introduce per-task `gate:` fields to `tasks.md` (kind:code specs only). Replace the single `.gate-frozen` sentinel with numbered `.gate-frozen-N` files. Thread `taskGates()` through `_lib.ts`, `spec-lint.ts`, `tasks-verify.ts`, `spec-complete.ts`, `enforce.ts`, and the agent/skill docs. Legacy single-gate path for rule/workflow/writeup kinds is preserved; bare `.gate-frozen` codepaths are deleted entirely.

## Files touched

- `scripts/_lib.ts` — add `taskGates(specDir)` helper returning `{ordinal, gatePath, frozen}[]`
- `specs/_template/tasks.md` — add per-task `gate:` field with inline doc
- `specs/_template/proposal.md` — add note that proposal-level `gate:` is derived from per-task gates for kind:code
- `scripts/spec-lint.ts` — validate per-task gate: present, unique, contiguous 1..N for kind:code; skip for non-code
- `scripts/tasks-verify.ts` — use taskGates(); skip unfrozen slices; enforce frozen slices; scaffold (no frozen) → green
- `scripts/spec-complete.ts` — require all .gate-frozen-N sentinels for kind:code; legacy path for non-code
- `.claude/hooks/enforce.ts` — replace findFrozenGateForPath + bare .gate-frozen logic with findSliceForPath + .gate-frozen-N; delete bare .gate-frozen codepath
- `.claude/skills/do/SKILL.md` — Step 5 scaffold-only; Step 6 per-slice loop (tester → judge → implementer per task); Step 7+ unchanged
- `.claude/agents/spec-tester.md` — scaffold mode (Step 5) vs slice mode (Step 6); commit message formats
- `.claude/agents/spec-judge.md` — per-slice review; writes .gate-frozen-N on PASS; tester-review-N.md on FAIL
- `.claude/agents/spec-implementer.md` — per-slice GREEN + refactor; slice-revision-blocker.md protocol
- `specs/constitution.md` — §4 slice-RED rules; kind:code-only gating; .gate-frozen-N naming

## Decisions

- **Decision 1 — kind:code only.** Slice-RED applies exclusively to `kind: code`. Rule/workflow/writeup keep batch-RED + skip-judge. The discovery loop between test and production code only exists for kind:code; for other kinds the gate IS the deliverable. Detection: `kind: code` in proposal frontmatter AND at least one task has `gate:` field.

- **Decision 2 — Hard-flip migration.** Bare `.gate-frozen` codepaths are deleted entirely; no dual-mode. `specs/active/` is empty (only `.gitkeep`) so no in-flight specs need migration.

- **Decision 3 — Frozen-slice revision via blocker file.** If implementing slice N reveals slice K < N has wrong tests, the implementer writes `slice-revision-blocker.md` naming the earlier slice and why, then stops. Human decides: manual `rm .gate-frozen-K` + push, or continue + open follow-up spec. No automation unfreezes.

- **Decision 4 — Proposal-level `gate:` field becomes derived.** For kind:code specs, the proposal-level `gate:` is a human-readable summary list derived from per-task gates; it is not a source of truth and not enforced by spec-lint. For non-code kinds, the proposal-level `gate:` scalar remains the authoritative single gate.

## Risks

- `spec-lint.ts` parser changes may break existing archived specs if any use nonstandard tasks.md format — mitigated by the `specs/archive/` immutability guarantee and the fact that spec-lint only checks `specs/active/`.
- Deleting bare `.gate-frozen` codepaths in enforce.ts could silently allow writes to previously-frozen gates if any archived specs still had in-flight worktrees — mitigated by confirming `specs/active/` is empty (`.gitkeep` only).

## Out of scope

- Auto-unfreezing of earlier slices (Decision 3).
- Migration of archived specs to new schema.
- Parallelism within a single spec's per-slice loop (slices are sequential by design — N+1 can only start once N is green).
- Changing the judge's authority model or the 3-strike escalation flow.
- Adding per-task gate support to rule/workflow/writeup kinds.
