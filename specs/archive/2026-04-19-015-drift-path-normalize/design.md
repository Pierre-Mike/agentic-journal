# Design

## Approach

Two-layer fix:

1. **Normalize event paths before matching.** A new pure helper
   `normalizeForMatch({ file, repoRoot })` strips a normalized `repoRoot`
   prefix from a normalized `file`. Returns `{ relative }` when `file` lives
   under the repo, `{ outside: true }` otherwise. Repo-relative inputs
   (already-relative strings) pass through unchanged for back-compat.
2. **Out-of-tree short-circuits to drift.** Allowlist globs are repo-relative
   by definition, so an absolute path outside the repo cannot meaningfully
   match any of them. `detectDrift` returns a drift finding without consulting
   the allowlist for any `outside: true` event.

```
TraceLine.file (absolute or relative)
        |
        v
normalizeForMatch({ file, repoRoot })
        |
   ┌────┴────┐
   v         v
in-repo    out-of-tree
(relative  (no allowlist
 form)      can match)
   |         |
   v         v
glob match → emit drift
```

`detectDrift` keeps its pure, named-param shape; `repoRoot` is added as a
required field. `aggregate()` likewise gains a required `repoRoot`. The CLI
`run()` supplies `repoRoot = process.cwd()`.

## Files touched

- `scripts/trace-scan.ts` — new `normalizeForMatch` helper; `detectDrift`
  signature gains required `repoRoot`; `aggregate` signature gains required
  `repoRoot`; CLI `run()` passes `process.cwd()`.
- `scripts/trace-scan.test.ts` — new `describe("detectDrift — path
  normalization (015)")` block (5 cases); update existing `aggregate` and
  `detectDrift` tests to pass a fixture `repoRoot`.

## Decisions

- **`repoRoot` is a REQUIRED named param.** No default, no optional. Pure
  function discipline: the detector reads no ambient `process.cwd()`. Callers
  (CLI, tests) supply it explicitly. Existing 011-era tests are updated in the
  same PR.
- **String-prefix on `path.normalize()` output.** No `fs.realpathSync()` —
  keeps the detector pure, deterministic, and fixture-friendly. Trace events
  produced by the observe hook are already absolute and not symlink-redirected,
  so realpath would add no information.
- **`DEFAULT_ALLOWED_FILES` left untouched.** Cross-repo writes (e.g.
  `~/.claude/plans/`, `Claude-research/`) will appear as drift after the fix —
  that's correct behavior. Drift is a finding, not a verdict. No personal
  paths get hardcoded into the repo allowlist.

## Risks

- **Existing callsites silently break at compile time.** Mitigated by
  TypeScript: making `repoRoot` required forces the change to surface as a
  type error rather than a runtime miscount. The same PR updates every
  callsite.
- **Old `.jsonl` traces with absolute paths replay differently.** That is the
  whole point: pre-fix data was being misclassified anyway. Replay parity is
  not a goal; correctness is.

## Out of scope

- Config-file allowlist (`~/.claude/drift-allowlist.json` or similar) for
  whitelisting cross-repo write patterns.
- `fs.realpathSync` resolution of symlinked roots.
- Observe hook changes — the hook continues to emit absolute paths.
- Tuning `DEFAULT_ALLOWED_FILES` — left for a future tuning spec if needed.
