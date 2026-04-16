# /retro findings — 2026-04-16

Window: 2026-04-09 → 2026-04-16. Signal: 5 archived specs (000–004), 4 merged PRs (#1–#4), 3 trace files (16 KB), 10 script files (all without colocated tests), 5 skills (only /do touched in window).

## Acted on

**F2 — Traces written but never read.** `/retro` skill declares it reads `.claude/traces/*.jsonl` to surface runtime patterns; no script aggregates them. Observability is wired on the write side only. Action: this spec (`005-trace-scan`).

## Deferred

- **F1 — 0/10 scripts have colocated tests.** Constitution §8 prefers colocated. Scripts predate the test-first norm introduced in spec 001. Next: add tests for `spec-complete` (resolveSpec), `_lib` (loadSpec/listActiveSpecs), `tasks-verify` (gate dispatch).

- **F3 — Delegation smoke is text-only.** Spec 004 shipped `Step 2.5 — Delegate` and a grep smoke of SKILL.md. No end-to-end test of a live subagent dispatch exists. Defer until 2–3 real dispatches observed.

- **F5 — Biome `noConsole: warn` noisy in scripts/.** Every commit in `scripts/` prints multiple warnings. Add a per-path Biome override: `{files: "scripts/**", linter.rules.suspicious.noConsole: "off"}`.

- **F6 — Empty `tests/` dir.** Sends the opposite signal from constitution §8. Delete.

- **F7 — Orphan `.claude/skills/align/evals/results/runs/2026-04-08T21-54-14`.** Add `.gitignore` pattern `**/evals/results/runs/**`.

## Positive signal (no action)

- **F4 — Time to green < 1 day on every spec in the window.** Healthy velocity.

## Inputs inspected

- `specs/archive/2026-04-{14,15,16}-*/proposal.md` (frontmatter for timings)
- `gh pr list --state merged --limit 20 --json …` (PRs #1–#4)
- `.claude/traces/*.jsonl` (3 files, 16 KB; sampled event shape)
- `scripts/*.ts` vs `scripts/*.test.ts` (delta: all 10 miss tests)
- `git log -1 --oneline -- .claude/skills/*/SKILL.md` (skill churn)
