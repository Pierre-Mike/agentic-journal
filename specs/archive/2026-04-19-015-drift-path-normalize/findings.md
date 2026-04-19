# /retro findings — 2026-04-18

Window: 2026-04-11 → 2026-04-18 (7 days)
Sources: 6 trace files (282 events), 16 archived specs, 15 merged PRs.

## 1. Drift detector glob mismatch [ACTED — this spec]

**Signal:** `bun run scripts/trace-scan.ts --since 7d` reports 32 drift entries, ALL of which are false positives. Allowlist uses repo-relative globs (`scripts/**`, `src/**`); events carry absolute paths.
**Hypothesis:** PR #12 (011-trace-shape-v2) added the `detectDrift` detector but never validated against real trace data; unit tests likely use relative-path fixtures.
**Action:** This spec — normalize paths before matching, require explicit `repoRoot`.
**Cited:** `scripts/trace-scan.ts:98-108`, `.claude/traces/60d35b9d-e51e-434a-be8f-0889978fe7d2.jsonl`.

## 2. Trace shape v2 emission unverified in production [DEFERRED]

**Signal:** No trace file written after PR #12 merged at 2026-04-18T22:47:47Z. Latest event in any trace is 22:15:04Z (32min before merge). Hook source declares span_id/duration_ms/status fields; production emission unconfirmed.
**Hypothesis:** Acceptance criteria covered unit tests, not live emission smoke. Could ship silently broken.
**Proposed action:** Add a smoke that runs a trivial tool call and asserts the next-written trace line carries span_id. Spec kind: `workflow`.

## 3. Cross-repo writes to plan dirs [DEFERRED — by design]

**Signal:** Session 60d35b9d wrote 20× to `Claude-research/.claude/plans/` and 4× to `~/.claude/plans/`.
**Hypothesis:** Plan-mode and cross-repo research are intentional and authorized via additional working directories.
**Proposed action:** None. Post-fix, these will appear as drift findings — that's correct. If they become noise in future retros, add a config-file-driven allowlist layer.

## 4. Apr 18 merge burst — 8 specs in one day [DEFERRED]

**Signal:** Specs 008-014 all archived 2026-04-18. PRs #11/#12/#13/#15 all merged within 2-min window at 22:43-22:48Z.
**Hypothesis:** Parallel /do delegation (PR #4) is working as designed. No CI thrash detected in this window.
**Proposed action:** None unless symptoms emerge (CI queue saturation, merge-order races, conflicting branch states).

## 5. Plan-file edit loops [DEFERRED]

**Signal:** trace-scan loop detector flagged Edit×6 on `research-agentic-journal-gap-registry.md`, Write×4 on `polymorphic-floating-blossom.md`. Loop threshold = 3.
**Hypothesis:** Iterative planning naturally edits the same file many times; threshold of 3 may be too aggressive for plan/* files.
**Proposed action:** Raise threshold to 5 OR exclude `*.md` files under `**/plans/**` from loop detection. Spec kind: `code`. Defer until a second retro confirms the pattern.
