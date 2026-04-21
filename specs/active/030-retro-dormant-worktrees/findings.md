# Findings — 2026-04-21 /retro cycle (second invocation, same day)

Window: 2026-04-14 → 2026-04-21 (7-day default, unchanged from prior cycle).

Sources scanned:
- 10 trace files (including today's session `971d3d0d`).
- 30 archived specs (000 → 029; 028 + 029 newly landed since prior retro).
- 31 merged PRs (including #29, #30).
- 0 active worktrees at cycle start (post-029 cleanup, post-git-pull sync).

---

## F1 — Hook-enforced blocks invisible in traces — SHIPPED prior cycle (spec 028)

Signal / hypothesis / action / kind unchanged from prior-cycle findings.md. PR #29 merged 2026-04-21.

## F2 — Hot-file edit saturation not surfaced — SHIPPED prior cycle (spec 029)

Signal / hypothesis / action / kind unchanged from prior-cycle findings.md. PR #30 merged 2026-04-21. First real data: today's session `971d3d0d` surfaced `scripts/trace-scan.ts ×10` (legitimate implementation work, not a revision cycle — threshold is sensitive but not noisy).

## F3 — Cross-repo edit leakage — DEFERRED (unchanged)

Still awaiting human policy decision. Options a/b/c documented in prior-cycle findings.md.

## F4 — Frontmatter date-format drift — DEFERRED (unchanged)

Still low-leverage. Touch-when-next-visited.

## F5 — Dormant in-flight worktree detection → **ACTED ON (this spec 030)**

**Signal.** Spec 028-hook-block-observability was authored 2026-04-20 and parked in `.agentic/worktrees/hook-block-observability` for ~18 hours with no open or merged PR. On 2026-04-21 the user manually noticed during `/retro` and had to instruct "first finish the work started on the worktree" before the retrospective could proceed. `git worktree list` + `gh pr list --state all --head spec/hook-block-observability` would have surfaced the dormancy immediately; neither was part of `/retro`'s precondition check.

**Hypothesis.** Dual-agent TDD has more phase boundaries than single-agent `/do` — spec-tester / spec-judge / spec-implementer — and any transition can drop the baton. The spec folder lives under `.agentic/worktrees/<slug>/specs/active/`, NOT under the main repo's `specs/active/`, so the main repo shows "no active specs" even when one is parked mid-pipeline. `/retro`'s precondition check inspects `specs/active/` but nothing cross-references it against `git worktree list`.

**Proposed action.** Add a pre-Step-2 preflight to `/retro`: new script `scripts/retro-preflight.ts` exports `detectDormantWorktrees()` that surfaces any `.agentic/worktrees/` path on a `spec/*` branch with NO PR (open or merged) and no activity in the last hour. Amend `.claude/skills/retro/SKILL.md` Step 2 to invoke the preflight and inline a `Dormant in-flight specs:` section at the top of the retro report.

**Kind.** workflow. Gate: `scripts/smoke-retro-dormant.ts` with fixture-driven assertions on path-prefix filter, branch-pattern filter, `--state all` PR flag, 1-hour age threshold, and real-subprocess fallback.

**Why now.** F5 was deferred in the prior cycle under the "one action per retrospective" rule. A second same-day `/retro` invocation legitimately promotes a deferred finding; the rule is per-invocation, not per-day.

---

## F6 (candidate, REJECTED) — Dual-agent tester attempt-1 under-coverage pattern

**Signal considered.** Both spec 028 and spec 029 failed spec-judge on attempt 1. Both required attempt 2.

**Why rejected.** Different rubric items — 028 failed item 1 (AC coverage — hook-side ACs unreachable from scanner-only fixtures), 029 failed item 3 (coverage gap — tiebreak ordering + null-file skip), 030 (in flight during this retro) failed items 2/3/4. No single failure mode repeated. The spec-judge's role per 027 design is to catch tester gaps; 50–67% first-attempt-pass rate is evidence the loop is functioning as designed, not evidence of a systematic tester defect. Two-three data points are thin for pattern claims. Deferred indefinitely pending stronger signal (e.g. ≥4 consecutive failures on the same rubric item).
