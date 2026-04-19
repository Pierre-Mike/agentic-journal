---
id: 016-red-commit-gate
title: Allow RED spec commits to bypass typecheck pre-commit
status: active
kind: rule
gate: scripts/red-commit-gate.test.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 008-hook-fail-open
supersedes: null
---

## Intent

The documented RED→GREEN spec authoring workflow must be executable end-to-end,
so every code spec preserves its failing-gate state in git history rather than
being collapsed into a single atomic commit by a typecheck hook that can't
distinguish work-in-progress from broken code.

A pure helper recognises RED-spec commit subjects (`^spec\(\d+\): RED\b`). The
lefthook pre-commit `typecheck` step shells out to it, reading the staged commit
subject from `.git/COMMIT_EDITMSG`, and skips typecheck only when the subject is
a RED commit. All other pre-commit hooks (biome, spec-lint, secret-scan) remain
unaffected.

## Constraints

- TS strict, no `any`, no `as` outside tests.
- `shouldSkipTypecheck` is pure and uses a named-parameter signature.
- `lefthook.yml` change is minimally invasive — single command body modified;
  no other hook stages, hooks, or commands touched.
- No new runtime dependencies; the helper uses Bun stdlib only.
- Helper is conservative: null/missing subject → return false (run typecheck).

## Acceptance criteria

- [ ] `scripts/red-commit-gate.ts` exports `shouldSkipTypecheck({ commitSubject })`
      (pure, named param, returns boolean).
- [ ] Same file exports `readCommitSubject()` resolving `.git/COMMIT_EDITMSG`
      via `git rev-parse --git-dir`.
- [ ] CLI entry (`import.meta.main`) exits 0 when subject matches RED, 1
      otherwise; null subject → exit 1.
- [ ] `lefthook.yml` pre-commit `typecheck` wraps in
      `if bun scripts/red-commit-gate.ts; then exit 0; fi; bun run typecheck`.
- [ ] `scripts/red-commit-gate.test.ts` covers all matrix cases listed in the
      design.
- [ ] Other pre-commit hooks (biome, spec-lint, secret-scan) unchanged.
- [ ] Manual sanity: `git commit --allow-empty -m "spec(999): RED — fixture"`
      succeeds without typecheck output; `git commit --allow-empty -m "feat: bar"`
      triggers typecheck normally.
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for 016-red-commit-gate.

## Context

Depends on 008-hook-fail-open (the most recent hook-discipline spec).

Discovered via `/retro` on 2026-04-19 from PR #16 (spec 015-drift-path-normalize)
deviation report: the subagent skipped the documented RED commit step because
the pre-commit `typecheck` hook blocks any commit with TS errors and the safety
protocol forbids `--no-verify`. All four tasks were collapsed into a single
GREEN commit, losing the RED→GREEN audit value in git history.

## Deferred findings (from /retro 2026-04-19)

The following non-acted findings were surfaced by /retro on 2026-04-19 but not
addressed in this spec. They live in `findings.md` alongside this proposal for
the audit trail.

- **Loop detector threshold of 3 fires false positives during normal iterative
  implementation.** Reinforced from prev retro. trace cf2060e3 had 3
  false-positive loops just from normal 4-task spec implementation. Action:
  raise threshold to 5, or exclude `*.md` plan files. Spec kind: code.
- **Drift allowlist still missing root config files** (`biome.json`,
  `.gitignore`, `lefthook.yml`, `package.json`, `tsconfig.json`). Post-fix retro
  shows these correctly classified as "not in allowlist" → drift, but they're
  legitimate in-repo write targets. Action: extend `DEFAULT_ALLOWED_FILES` with
  `*.json`, `*.yml`, `*.yaml`, `*.toml`, `.gitignore` at root level. Spec kind:
  code.
- **Trace shape v2 emission VERIFIED in production** (resolves prev deferred
  finding). trace cf2060e3 carries all v2 fields (`span_id`, `parent_span_id`,
  `started_at`, `duration_ms`, `status`). No spec needed; closed.
- **Subagent-aware Write hook blocked findings.md authorship** in PR #16's
  subagent. Hook message: "Subagents should return findings as text".
  Workaround: Bash heredoc. Conflict between `/retro` skill (requires
  `findings.md` inside spec folder) and the subagent guard. Action: hook
  exception for paths matching `specs/active/*/findings.md`, OR `/retro` writes
  `findings.md` from main session pre-delegation. Spec kind: rule or workflow.
