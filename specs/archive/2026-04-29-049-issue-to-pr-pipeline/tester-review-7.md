# Tester review — 049 slice 7 (attempt 2 of 3)

**Verdict**: PASS

## Rubric

### Item 0: RED proven
PASS. exit_code=1, 39 failing tests; failure mode is `slice.yml not found at .github/workflows/slice.yml` (file-existence guard), not tautology. RED confirmed.

### Item 1: Acceptance criterion coverage
YES.

Mapping (proposal AC #6 + alignment Big Picture + Failure handling):
- AC: trigger = `repository_dispatch` → tests "on.repository_dispatch is present", "repository_dispatch has a types array (slice-related)", and exclusivity test "no push/schedule" ✓ (AC contradiction from attempt 1 is resolved — repository_dispatch is now primary, workflow_dispatch is secondary manual bridge)
- AC: workflow_dispatch as manual bridge with inputs slice_id/spec_id/branch → tests in "trigger events — workflow_dispatch" block ✓
- AC: input normalization (client_payload || inputs) → tests in "input normalization" block ✓
- AC: claude -p with expertise skill → "invokes claude with -p", "expertise skill loaded via explicit flag/path/env" (now requires `--skill expertise`, `--load-skill expertise`, `.claude/skills/expertise`, or skill-namespaced env, not bare substring) ✓
- AC: pull --rebase + push retry on conflict → "pull-rebase before work" + "push with retry" + "retry includes pull --rebase" ✓
- Alignment: retry budget = 3 → "push retry budget is exactly 3" + "failure-menu guard pins retry count to 3" ✓
- Alignment: fresh context per slice → "claude invoked with --no-resume" ✓
- Alignment: replanner after work → "replanner invocation" + ordering test ✓
- Alignment: failure menu posted on the issue (not PR) → "failure-menu step uses 'gh issue comment' (not gh pr comment)" + permissions assertion `issues: write` ✓
- New: commit step between pull-rebase and push → "commit between pull-rebase and push" ✓
- New: cross-spec invariant — controller's dispatch verb matches slice.yml trigger → "cross-spec trigger invariant" ✓

All attempt-1 blockers (AC trigger contradiction, retry-budget=3, gh issue vs gh pr, issues:write permission, commit step, expertise tightening, cross-spec invariant) are addressed.

### Item 2: Adversarial gap
YES — searched, one minor residual.

Residual: the "expertise skill" test accepts an env value containing both `expertise` and `skill` (case-insensitive), which a non-skill env like `LEGACY_EXPERTISE_SKILL_NAME=disabled` could satisfy. However, the cumulative gate (env key must include SKILL/skill *and* its value must contain `expertise`) is a substantial tightening over attempt 1's bare-substring check, and the alternative branches (`--skill expertise`, `.claude/skills/expertise`, `--load-skill expertise`) are precise. Acceptable given a malicious-but-not-self-defeating implementer would have to deliberately invent env names like `CLAUDE_LOAD_SKILLS=expertise` to satisfy gates while loading nothing — at which point they're past spec compliance into willful sabotage. Not a structural blocker.

Mitigated: bare-substring "expertise" comments → no longer pass (require flag/path/env-key+value pattern). `--no-resume` is now anchored to the same step containing `claude -p`. Concurrency group is structurally checked (both spec_id and slice_id present), prefix unconstrained.

### Item 3: Coverage gap
NO — none.

All 5 gaps from attempt 1 are closed:
1. Cross-spec invariant (controller dispatch verb ↔ slice trigger) → covered (test 15).
2. Retry budget = 3 → covered (push-retry-budget-3 test + failure-menu retry-count-3 test).
3. Failure menu posts to issue (not PR) → covered ("gh issue comment" / not "gh pr comment" assertion).
4. Commit before push → covered (commit-between-pull-and-push ordering test).
5. `issues: write` permission → covered (permissions block test).

### Item 4: Behavior vs implementation detail
YES — tests behavior-pinned.

- Concurrency: prefix `slice-` removed; structural check on spec_id+slice_id presence. Behavior-pinned.
- `actions/checkout@v4` and `ubuntu-latest` are still pinned but these are repo conventions and the attempt-1 review flagged them as minor; acceptable.
- Run-block assertions (`git pull --rebase`, `git push origin`, `claude -p`, `--no-resume`, `--max-turns`, `MAX_RETRIES=3`) are observable workflow behavior, not internal naming.
- Cross-spec invariant test gracefully handles missing controller.yml (early-return) — does not over-pin slice 6's exact dispatch shape.

## Verdict summary

PASS. All four attempt-1 blocker categories — trigger contradiction (Item 1), retry-budget pin (Item 3.2), gh-issue-vs-pr (Item 3.3), `issues: write` permission (Item 3.5), commit step (Item 3.4), expertise-skill tightening (Item 2), and cross-spec invariant (Item 3.1) — are resolved. RED is genuine (file does not exist; 39/39 fail with file-not-found, not tautology). One minor residual on the expertise-skill env-key+value branch, but it requires deliberately bad-faith env naming to subvert and the precise-flag branches dominate. Tests are behavior-pinned with acceptable repo-convention exceptions. Frozen.
