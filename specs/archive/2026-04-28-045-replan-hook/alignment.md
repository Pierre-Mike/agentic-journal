---
status: confirmed
confidence: high
intent_hash: a35e3e0cc8a2
created: 2026-04-28
---

# Alignment — post-slice re-plan hook

## Goal
Close the feedback loop where slice 1 implementation often reveals slice 2 was mis-specified. Today `tasks.md` is frozen at scaffold time and there is no formal "re-plan downstream" step — the implementer either does extra work outside the slice's `file_targets` (axiom violation), plows ahead with a now-wrong slice 2 plan, or the human re-plans manually outside the spec workflow. None of those are good.

## Big Picture
After `spec-implementer` commits GREEN + refactor for slice N, a cheap `spec-replanner` subagent runs:
1. Diff slice N's implementation against `design.md` (the original plan)
2. If implementation deviated meaningfully, check whether downstream tasks (N+1..M) are still accurate
3. If any are invalidated, patch `tasks.md` — rewrite task body, update `file_targets`, add/remove tasks — and commit `replan(<id>): N+1`
4. If no change needed, exit silently (no commit)

The next slice's `spec-tester` reads the patched `tasks.md`. The re-plan is a normal commit on the spec branch, visible in the PR diff.

```
slice N RED → GREEN → refactor → ╔═══════════════════════════╗
                                  ║ spec-replanner (haiku)    ║
                                  ║ diff impl vs design.md    ║
                                  ║ patch tasks.md if needed  ║
                                  ║ commit "replan(<id>): N+1"║
                                  ╚═══════════════════════════╝
                                              ↓
                              slice N+1 RED (tester reads patched tasks.md)
```

## Straightforward Details
- New subagent: `.claude/agents/spec-replanner.md` — model: haiku (fast, cheap, scoped). Reads-only on source code; writes-only to `tasks.md` (and rarely appends to `design.md`'s "Replanning notes" section).
- Triggered after each slice's refactor commit lands, before the next slice's `spec-tester` dispatch.
- Replanner input (handoff prompt from /do): `proposal.md` + `alignment.md` + `design.md` + current `tasks.md` + the slice's diff (from `git diff` between the commit before the slice's RED and HEAD).
- Replanner output: either no-op exit, or a patched `tasks.md` + commit `replan(<id>): N+1` (where N+1 is the next slice index that was patched).
- Scope guard (hook-enforced): replanner can ONLY edit `tasks.md` and APPEND to `design.md`. Cannot touch source code, gates, or any file outside the spec folder. The pre-tool-use guard already exists; reuse the pattern.
- `/do` Step 6 loop adds the replanner dispatch after the refactor commit and before the next slice's tester.

## Non-obvious Decisions

**D1 — Replanner runs after every slice or only when impl deviates significantly?**
⭐ Run after every slice. The replanner itself decides whether to patch — its first job is "is there even a deviation worth re-planning for?" — and it exits silently if not. Cheap on haiku.
❌ Conditional trigger based on diff size. False negatives when small diffs hide significant logic shifts (e.g., a one-line refactor that changes which library is used).

**D2 — Can the replanner rewrite `design.md`?**
⭐ NO, only `tasks.md`. `design.md` is the original plan; preserving it matters for retrospectives ("we planned X, implemented Y, here's what we learned"). Replanner MAY APPEND a `## Replanning notes` section but never rewrites existing content.
❌ Allow rewriting. Destroys the audit trail.

**D3 — How does the replanner know slice N's diff?**
⭐ Use git: `git diff <commit-before-slice-N-RED>..HEAD -- <implementation paths>`. The /do orchestrator passes the SHA range and the implementation file paths in the handoff. Deterministic.
❌ Pass the implementer's tool-call log. Too noisy.

**D4 — Replanner blocks /do flow on conflict?**
⭐ NO, soft escalation. If the deviation is too significant for the replanner to handle (e.g., the outer gate is now meaningless given the new implementation), it writes `replan-escalation.md` next to `proposal.md` with notes for human review, exits 0. /do continues to the next slice; the file surfaces in the PR review.
❌ Hard block. Overkill — replanner's job is to keep momentum, not gatekeep.
