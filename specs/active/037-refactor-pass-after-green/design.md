# Design — 036 Refactor pass after green for kind:code

## Approach

Edit `.claude/agents/spec-implementer.md` to add a `### Step 6.5 — Refactor pass` section immediately after the existing Step 6 (tasks:verify loop). The section is gated on `kind: code` so that rule/workflow/writeup specs are untouched.

Replace the exit-1 stub in `scripts/smoke-implementer-refactor.ts` with real assertions that parse `spec-implementer.md` and verify the invariants declared in proposal.md's acceptance criteria.

## Files touched

- `.claude/agents/spec-implementer.md` — add Step 6.5 section
- `scripts/smoke-implementer-refactor.ts` — replace stub with real assertions

## Step 6.5 content (to author)

```
### Step 6.5 — Refactor pass (kind: code only)

Skip this step for kind: rule, kind: workflow, and kind: writeup.

After `bun run tasks:verify` first goes green, run a single refactor pass:

1. Identify the union of all `file_targets` declared across this spec's `tasks.md` entries. These are the only files in scope.
2. For each file in scope, consider one refactor opportunity at a time (rename, extract, simplify, remove duplication). Apply if clearly beneficial.
3. After every edit, re-run `bun run tasks:verify`. If it fails, revert that single file (`git checkout -- <file>`) and move on.
4. Terminate when no further opportunity exists or all files in scope have been considered.
5. Do NOT edit files outside the `file_targets` union. Cross-cutting refactors become their own spec via /retro.
6. Do NOT retry to green after a revert — the refactor pass is bounded, not a second implementation phase.
```

## Decisions

1. **Inline in spec-implementer, not a separate subagent.** Refactor's self-collusion mode ("doesn't recognize own code smell") is weaker than the test-design collusion that justified the original tester/judge split (8–11pp pass@1 gap per AgentCoder/Code-A1). Fourth agent would triple token cost for marginal safety gain. Constitution §2 deterministic-first argues against premature agent multiplication.
2. **Scope-bound to `file_targets`, not opportunistic.** Aligns with implementer's existing rule "do not opportunistically refactor elsewhere." Cross-cutting refactors become their own spec via /retro. Preserves clean spec archive — every cleanup has a spec trace.
3. **Revert-on-fail, not retry-to-green.** If a refactor edit breaks tasks:verify, the implementer reverts that single edit and moves on — does NOT enter an unbounded retry loop. Keeps the refactor beat from becoming a second implementation phase.
4. **kind:code only.** rule/workflow/writeup specs have no source code to refactor — the gate fixture/script/markdown IS the deliverable.

## Out of scope

- NOT changing `.claude/skills/do/SKILL.md`
- NOT adding a new subagent
- NOT touching rule/workflow/writeup code paths
- NOT changing the `.gate-frozen` mechanism
- NOT changing `scripts/tasks-verify.ts`
