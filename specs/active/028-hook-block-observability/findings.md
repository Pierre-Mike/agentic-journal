# Retrospective findings — 2026-04-20

Source: `/retro` (window: 2026-04-13 → 2026-04-20). Spec 028 acts on F1; F2–F5 are deferred for future retros.

## F1 — Hook blocks are invisible in traces (acted on)

`grep '"status":"blocked"'` across all traces: 0 hits. `inferStatus()` at `.claude/hooks/observe.ts:77-85` declares "blocked" in its return type but never emits it. Blocked `PreToolUse` calls `process.exit(2)` in `.claude/hooks/enforce.ts` → no `PostToolUse` fires → rule friction is invisible to `/retro`. This spec wires the missing signal.

## F2 — Cross-repo file touches from repo-scoped sessions (deferred)

Session `60d35b9d` touched `/Users/pierre-mikel/Github/Claude-research/.claude/plans/research-agentic-journal-gap-registry.md` ×20; session `2573cb17` edited `~/.claude/claude-dashboard.py`; session `068fb18c` wrote `~/.claude/plans/polymorphic-floating-blossom.md` ×2. Likely intentional meta-research, but no scope annotation distinguishes intent from drift.

## F3 — Loop-detector ceiling is noise, not signal (deferred)

14 loops all ring in at ×3. That's RED→GREEN→refactor TDD cadence, not stuck-agent behavior. Threshold should be ≥5 or time-bounded.

## F4 — Trace has no duration anomaly surface (deferred)

`duration_ms` is captured per span but `trace-scan.ts` doesn't surface p95 or outliers — we'd miss a stuck tool call.

## F5 — Spec 005 double-issued slugs (deferred)

Historical: `005-trace-scan` and `005-workflow-canvas` shared ID 005. `spec-lint` may now guard — worth verifying next retro.
