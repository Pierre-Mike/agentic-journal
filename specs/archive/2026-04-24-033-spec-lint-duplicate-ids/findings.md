---
source: /retro --since 7d
window: 2026-04-17 → 2026-04-24
generated: 2026-04-24
---

# Retrospective findings

## Activity summary

- 32 specs archived in window (7-day burst; 04-19 alone = 12 specs).
- 13 trace files (`.claude/traces/*.jsonl`); 0 dormant worktrees.
- Tool mix (PreToolUse): Write 222, Edit 164. No other tools emit to traces.

## Findings

### 1. Spec number collisions — ACTED ON (this spec)

**Signal.** Number `030` appears 3× across archive folders:
- `2026-04-21-030-retro-dormant-worktrees`
- `2026-04-22-030-fold-judge-escalation`
- `2026-04-22-030-skip-judge-rule-workflow`

**Hypothesis.** `/do` SKILL.md prescribes "max ID + 1" (Step 3) but no script enforces it. Parallel `/do` dispatches read `specs/active/` + `specs/archive/` simultaneously, both compute the same max, both allocate the same NNN. Spec-lint checks gate-path uniqueness but not ID uniqueness.

**Action.** This spec adds a duplicate-ID pass to `spec-lint`. Archive is renumbered as a GREEN side-effect.

**Kind.** `rule`.

### 2. Hot-file detector (spec 029) didn't self-flag `scripts/trace-scan.ts` — DEFERRED

**Signal.** `scripts/trace-scan.ts` edited 11× in window across two worktrees:
- `drift-path-normalize` worktree: 5 edits (file + test together)
- `hot-file-saturation` worktree: 5 edits

**Hypothesis.** Spec 029's hot-file saturation detector likely scopes per-session or per-worktree; cross-worktree saturation is invisible. The file is hot across workstreams, which is arguably a more interesting signal than hot within one workstream.

**Proposed action.** Extend `scripts/trace-scan.ts` hot-file pass to aggregate edits across all traces in the window, not just per-session.

**Kind.** `code`.

### 3. Zero `ToolBlocked` events across all 13 traces — DEFERRED

**Signal.** `grep -l "ToolBlocked" .claude/traces/*.jsonl` → empty. Spec 028 shipped `emitBlocked` wiring in `.claude/hooks/observe.ts:105` and 4 `block()` calls in `.claude/hooks/enforce.ts`. `scripts/trace-scan.ts:340` parses these events.

**Hypothesis.** Two possibilities — (a) `enforce.ts` genuinely never blocked anything in 7 days (happy path, no action); (b) the emit path is broken end-to-end and we don't know it. Can't distinguish without a canary.

**Proposed action.** Add a canary smoke that drives a synthetic block event end-to-end through `hooks.ts` → `enforce.ts` → `observe.ts` → trace file and asserts `ToolBlocked` lands in the jsonl. Fails loud if wiring regresses.

**Kind.** `code`.

### 4. `/do` Step 3 allocation hardening — DEFERRED (follow-up to finding 1)

**Signal.** Finding 1's fix is lint-only. Lint catches at pre-push / CI, but two parallel `/do` dispatches can still both allocate the same NNN at worktree-open time and race each other into two separate collisions before either reaches push. The tokens spent on both spec-tester and spec-judge runs for the loser are wasted.

**Proposed action.** Atomic allocation in `/do` Step 3 via `mkdir` as the atomic op, or a registry file with advisory lock. Distinct architectural decision; deserves its own spec with its own alignment pass.

**Kind.** `workflow`.

### 5. Trace-v2 rollout is healthy — NO ACTION

**Signal.** Traces from pre-spec-011 sessions emit `span_id: null, duration_ms: null, status: null`; post-spec-011 sessions populate all three correctly.

**Hypothesis.** Expected cutover; no regression.

## Ranking rationale

Finding 1 picked: deterministic rule, one-line check, blocks a silent-corruption failure mode on every future parallel `/do`. Highest leverage because it prevents a recurrence of a pattern already observed 3× in one day.

Findings 2–4 are real but each needs its own design pass and test harness. Bundling them would dilute the spec surface and delay the lint rule landing.
