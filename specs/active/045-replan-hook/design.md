# Design — post-slice re-plan hook

## Approach

Insert a `spec-replanner` subagent dispatch into `/do`'s Step 6 per-slice loop, triggered after each slice's refactor commit lands. The replanner reads the slice's implementation diff, compares it to `design.md`, and patches `tasks.md` if downstream slices are invalidated.

**Flow insertion point**:
```
for slice N = 1..taskCount:
  [tester → judge → implementer → refactor commit]
  ╔═══════════════════════════════════════╗
  ║ NEW: spec-replanner dispatch          ║
  ║ input: proposal + alignment + design  ║
  ║        + tasks.md + slice N diff      ║
  ║ output: patched tasks.md OR no-op     ║
  ╚═══════════════════════════════════════╝
  [next slice's tester reads patched tasks.md]
```

The replanner is:
- **Model**: haiku (cheap, fast, scoped)
- **Allowed tools**: Read, Edit (tasks.md + design.md only), Bash (git diff/log/add/commit)
- **Scope guard**: enforced by the existing pre-tool-use hook (same pattern as spec-judge vs spec-implementer separation)
- **Commit convention**: `replan(<id>): N+1` where N+1 is the first downstream slice index that was patched
- **Soft escalation**: if the deviation is too large to auto-patch, write `replan-escalation.md`, exit 0, continue

**Replanner handoff prompt structure**:
```
You are spec-replanner for spec <id>. Slice N just landed (RED → GREEN → refactor).

Input:
- specs/active/<id>/proposal.md
- specs/active/<id>/alignment.md
- specs/active/<id>/design.md
- specs/active/<id>/tasks.md (current state)
- Slice N diff: git diff <sha-before-red>..<sha-after-refactor> -- <file_targets>

Job:
1. Compare slice N's implementation to design.md
2. If meaningful deviation exists, check if tasks N+1..M are still accurate
3. If any task is invalidated: patch tasks.md (rewrite body, update file_targets, add/remove tasks), commit "replan(<id>): N+1"
4. If deviation is too large to auto-patch: write replan-escalation.md, exit 0
5. If no re-plan needed: exit 0 (no commit)

You may ONLY edit tasks.md and APPEND to design.md. You may NOT touch source code, gate files, or any implementation paths.
```

## Files touched

- `.claude/agents/spec-replanner.md` — new agent definition (model: haiku, scoped tools)
- `.claude/skills/do/SKILL.md` — Step 6 per-slice loop: insert replanner dispatch after refactor commit, before next slice's tester
- `scripts/smoke-replan-flow.ts` — gate validator (RED fixture that simulates 2-slice spec where slice 1 invalidates slice 2)
- `specs/constitution.md` — new subsection documenting replanner role + scope guard

## Decisions

**D1 — Replanner runs after every slice or only when impl deviates?**
Run after every slice. The replanner decides whether to patch; cheap on haiku. Avoids false negatives where small diffs hide significant logic shifts.

**D2 — Can the replanner rewrite design.md?**
NO, only `tasks.md`. `design.md` is the original plan; preserving it matters for retrospectives. Replanner MAY APPEND a `## Replanning notes` section but never rewrites existing content.

**D3 — How does the replanner know slice N's diff?**
Git: `git diff <sha-before-red>..<sha-after-refactor> -- <file_targets>`. The /do orchestrator passes the SHA range + file paths in the handoff. Deterministic.

**D4 — Replanner blocks /do flow on conflict?**
NO, soft escalation. Write `replan-escalation.md`, exit 0, continue. The file surfaces in PR review.

**D5 — Per-slice gates for this spec?**
NO. This is `kind: workflow`, not `kind: code`. No slice-RED TDD. The outer gate (`scripts/smoke-replan-flow.ts`) is the only gate, and it validates the entire replanner flow end-to-end.

## Out of scope

- Retroactive re-planning for archived specs (no alignment.md, no design.md to diff against)
- Re-planning within a single slice (only downstream slices N+1..M are patched)
- LLM-based "should we re-plan?" heuristic (the replanner always runs; it decides inline whether to patch)
