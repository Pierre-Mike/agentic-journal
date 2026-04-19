---
id: 015-drift-path-normalize
title: >-
  Drift detector path normalization — distinguish in-repo from out-of-tree
  writes
status: archived
kind: code
gate: scripts/trace-scan.test.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 011-trace-shape-v2
supersedes: null
archived: '2026-04-19'
---

## Intent

The trace-scan drift signal must distinguish in-repo writes from genuinely
out-of-tree writes, so `/retro` can trust it as a leading indicator of scope
violations rather than treating every event as noise.

`detectDrift` currently glob-matches a repo-relative allowlist (`scripts/**`,
`src/**`, …) against absolute event paths emitted by the observe hook. The two
are never going to match, so every in-repo write is flagged as drift. On the
2026-04-18 retro window this produced 32 false positives.

Two-layer fix: (1) normalize event paths against an explicit `repoRoot` before
matching, and (2) treat anything outside `repoRoot` as inherently
drift-candidate (allowlist patterns are repo-relative by definition, so they
cannot meaningfully match an absolute external path).

## Constraints

- TS strict, no `any`, no `as` outside tests.
- Named-parameter style for new helpers and modified signatures.
- Pure detector — `detectDrift` and `normalizeForMatch` perform no fs IO and
  read no ambient state (`process.cwd()` is supplied by the caller, not read
  inside the detector).
- Back-compat for repo-relative `file` strings: existing callers that already
  passed relative paths must continue to produce the same findings.
- `repoRoot` is REQUIRED on `detectDrift` and `aggregate` — no default, no
  optional. Callers update in the same PR.

## Acceptance criteria

- [ ] `normalizeForMatch({ file, repoRoot })` exists in `scripts/trace-scan.ts`
      and returns `{ relative: string } | { outside: true }`.
- [ ] `detectDrift({ events, allowedFiles, repoRoot })` accepts required
      `repoRoot`; short-circuits to drift on `outside: true`.
- [ ] Existing `detectDrift` callsites (in `aggregate()` and tests) updated to
      pass `repoRoot`.
- [ ] CLI passes `repoRoot = process.cwd()`.
- [ ] New tests in `scripts/trace-scan.test.ts` cover: in-repo allowed,
      in-repo not-allowed, out-of-repo, repo-relative back-compat,
      trailing-slash repoRoot.
- [ ] `bun run scripts/trace-scan.ts --since 7d` no longer reports in-repo
      writes as drift.
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for 015-drift-path-normalize.

## Context

Depends on 005-trace-scan (introduced the aggregator and CLI) and
011-trace-shape-v2 (introduced the `detectDrift` detector).

Discovered during `/retro` on 2026-04-18: the drift section of
`bun run scripts/trace-scan.ts --since 7d` emitted 32 false-positive entries,
all of which were ordinary in-repo writes to `scripts/**`, `src/**`,
`.claude/**` etc. The detector compared absolute paths against repo-relative
globs and never matched anything.

## Deferred findings (from /retro 2026-04-18)

The following non-acted findings were surfaced by /retro on 2026-04-18 but not
addressed in this spec. They live in `findings.md` alongside this proposal for
the audit trail.

- **Trace shape v2 emission unverified in production.** Hook source claims it
  writes span_id/duration_ms/status, but no post-merge session has been
  recorded yet. Risk: silent breakage. Defer to next retro after a fresh
  session lands.
- **Cross-repo writes to `~/.claude/plans/` and
  `Claude-research/.claude/plans/`.** Intentional reconnaissance writes from
  plan mode. Not actionable in code; documenting that future drift findings on
  these paths are expected (and now correctly classified post-fix).
- **Apr 18 merge burst — 8 specs archived in one day.** Success signal of
  parallel /do delegation working. Defer; revisit only if CI thrash or
  merge-order races emerge.
- **Plan-file edit loops (Edit×6 same file in single session).** Real but
  expected for iterative planning. Borderline. Consider raising loop threshold
  from 3 to 5 in a future trace-scan tuning spec.
