# Findings — 2026-04-21 /retro cycle

Window: 2026-04-14 → 2026-04-21 (7 days).

Sources scanned:
- 9 trace files in `.claude/traces/*.jsonl` (549 events).
- 28 archived specs (`specs/archive/2026-04-14-000-…` through `2026-04-20-027-dual-agent-tdd`).
- 29 merged PRs (#1 through #29, all green on merge).
- 1 active worktree at cycle start (`spec/hook-block-observability`, shipped during cycle).

Findings ranked by leverage. One acted on; the rest deferred.

---

## F1 — Hook-enforced blocks invisible in traces → **SHIPPED as spec 028**

**Signal.** Pre/Post tool-use imbalance across sessions — `60d35b9d` had 16 unmatched Pre events (96 Pre vs 72 Post), `f469afac` +2, `f60552a3` +1. No trace carried `status:"blocked"`. `observe.ts::inferStatus()` declared the status in its return type but `enforce.ts::block()` exited (`process.exit(2)`) without emitting.

**Hypothesis.** Hook friction was invisible — `/retro` could not measure which rules blocked which files, so threshold-tuning was guesswork.

**Proposed action.** Upgrade `block()` to `block(event, reason, filePath)`. Emit a `ToolBlocked` line with `status:"blocked"` to the session `.jsonl` BEFORE throwing `BlockError`. Extend `scripts/trace-scan.ts` with `parseBlocked` / `renderBlocks` and a `Blocks:` render section.

**Kind.** code.

**Status.** Shipped 2026-04-21 as spec 028-hook-block-observability (PR #29 merged, commit `1d0fd17`). Attempt 1 failed the spec-judge on rubric item 1 (scanner-only gate left three hook-side ACs unreachable); attempt 2 widened the gate to `.claude/hooks/enforce.test.ts` and passed. First multi-file gate in the dual-agent TDD loop.

---

## F2 — Hot-file edit saturation not surfaced → **ACTED ON (this spec)**

**Signal.** Session `60d35b9d-…` (2026-04-18, 168 events, 14 sub-agents, ~1 hour) hit `/Users/pierre-mikel/Github/Claude-research/.claude/plans/research-agentic-journal-gap-registry.md` ×20. Session `cf2060e3-…` (2026-04-19, 156 events) hit `.../tdd-importance.mdx` ×24. `detectLoops` from spec 011 uses a rolling window of 10 with maxRepeats 3 — it only catches *burst* patterns where the same file recurs within a short window. Both saturation cases involved edits interleaved with other files across the session, so the burst detector found only a ×6 sub-loop for `gap-registry.md` and missed the total ×20 entirely. No other detector catches session-total volume.

**Hypothesis.** Long revision cycles on a single file are currently invisible. They only surface as "that session felt long" subjective memory. Without surfacing, there is no pressure to consolidate, pause, or hand off to a reviewer.

**Proposed action.** Add `detectHotFiles` (pure) with threshold parameter (default 10) — emits one finding per `(session_id, file)` meeting the threshold. Add `renderHotFiles` + `Hot files:` render section mirroring `Loops:` / `Drift:` / `Blocks:`. Gate: `scripts/trace-scan.test.ts` with assertions on threshold, counting, tie-break ordering, null-file skipping, and empty-render behavior.

**Kind.** code.

**Why scanner-first, not hook-enforced rule.** Two reasons. (1) 028 just landed; we do not yet have real `ToolBlocked` data to inform where a hard ceiling should sit. Surfacing first + thresholding later is cheaper than guessing the threshold now. (2) A hook ceiling could interrupt legitimate long writeup drafts. Once 028's data accumulates we can file a follow-up rule-spec with a justified threshold.

---

## F3 — Cross-repo edit leakage — DEFERRED

**Signal.** Approximately 28 events across 3 sessions targeted files outside the project root:
- `60d35b9d`: 20 edits to `/Users/pierre-mikel/Github/Claude-research/.claude/plans/research-agentic-journal-gap-registry.md`.
- `f469afac`: 4 edits to `/Users/pierre-mikel/.claude/plans/golden-tinkering-tiger.md`.
- `068fb18c`: 4 edits to `/Users/pierre-mikel/.claude/plans/polymorphic-floating-blossom.md`.

No drift detection, no boundary warning, no task-boundary enforcement.

**Hypothesis.** Ambiguous intent — some may be legitimate cross-repo research notes (user uses Claude Code to manage his research repo too); some may be accidental drift during long subagent chains. A bright-line rule could break the legitimate flow.

**Proposed action.** Needs human policy decision before it becomes a rule. Options: (a) hard-block writes outside the project root unless the active spec declares a `boundary: multi-repo` tag; (b) soft-warn via a `Cross-repo:` trace-scan render section (scanner-only, analogous to F2); (c) leave as-is and document the convention in AGENTS.md.

**Kind.** rule (if (a)) or code (if (b)).

---

## F4 — Frontmatter `created:` / `archived:` format drift — DEFERRED

**Signal.** Specs 000–007 use `created: 2026-04-14` (YYYY-MM-DD). Specs 001–027 use `created: 2026-04-16T00:00:00.000Z` (ISO with time component). All `archived:` fields are single-quoted: `'2026-04-15'`. Three formats in one frontmatter convention.

**Hypothesis.** `spec-lint.ts` does not normalize date fields. The spec-archive script writes one format; the spec-tester subagent writes another; early manual specs used a third.

**Proposed action.** Pin `created:` and `archived:` to unquoted `YYYY-MM-DD` via a new `spec-lint.ts` rule. Backfill existing specs (write-amnesty via `specs/archive/**` immutability rule temporarily waived for a single maintenance PR).

**Kind.** rule.

**Why deferred.** Low leverage (doesn't block any workflow; at most trips casual jq scans). Touch-when-next-visited.

---

## F5 — In-flight spec with no open PR — DEFERRED

**Signal.** Spec 028-hook-block-observability was authored 2026-04-20 (attempt 1 RED committed at `e8092e3`). It sat in a worktree with no open PR until 2026-04-21 morning. The user had to manually notice ("first finish the work started on the worktree") and instruct a restart. `gh pr list --state open` would have surfaced the gap immediately; `/retro` did not look.

**Hypothesis.** `/retro` preconditions check "mid-execution of another spec" but only scan `specs/active/`. A worktree whose gate was frozen but whose implementer had not yet run is "active" in the filesystem but invisible to any health check. The pattern will recur — dual-agent TDD has more phase boundaries than single-agent `/do`, and any of them can drop the baton.

**Proposed action.** Extend `/retro` preconditions: scan `git worktree list` for `.agentic/worktrees/*` and cross-reference with `gh pr list --state open`. Any worktree on a `spec/*` branch with no open PR AND no merged PR is an in-flight dormant spec — surface it in the retro report before findings, so the human can resume or abandon.

**Kind.** workflow (skill-level, not code).

**Why deferred.** One action per retrospective. F2 wins on leverage because it surfaces a pattern we can measure across future sessions; F5 is a safety-net for a narrow failure mode that just happened but may not recur.

---

## Acted-on finding summary

Top pick: **F2 — hot-file edit saturation**. Scanner-first, natural companion to spec 011's detector suite and spec 028's `Blocks:` section. Gate: `scripts/trace-scan.test.ts`. Kind: code. Authored via `/do` in this same cycle, spec id 029.

Deferred findings remain in this file as the spec's audit trail. A future `/retro` cycle may promote F3, F4, or F5 once the signal justifies.
