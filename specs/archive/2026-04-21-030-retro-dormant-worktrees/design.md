# Design — 030-retro-dormant-worktrees

## Approach

**Preflight script (`scripts/retro-preflight.ts`).** Exports a pure-ish `detectDormantWorktrees()` function that:
1. Shells out to `git worktree list --porcelain` to enumerate all worktrees.
2. Filters to paths under `.agentic/worktrees/` whose branch matches `^spec/.+$`.
3. For each candidate, shells out to `gh pr list --state all --head <branch> --json number` and skips if result is non-empty.
4. Checks `git log -1 --format=%cI -- <worktree_path>` for last commit timestamp; skips if <1 hour old.
5. Returns `DormantSpec[]` with slug, branch, worktree_path, age_days, last_commit_sha, last_commit_ts.

CLI entrypoint (`if (import.meta.main)`): parses `--json` flag. Default text output begins with `Dormant in-flight specs:` header listing each entry, or empty string if none.

**Skill wiring (`.claude/skills/retro/SKILL.md`).** Step 2 amended to run `bun scripts/retro-preflight.ts` first and inline its output. If output is non-empty, the preflight section appears at the very top of the report above findings. If dormant worktrees are found, the retro must not author a new spec until they are addressed.

## Files touched

| File | Status |
|---|---|
| `scripts/retro-preflight.ts` | New — core detection logic + CLI |
| `.claude/skills/retro/SKILL.md` | Amended — Step 2 invokes preflight |
| `scripts/smoke-retro-dormant.ts` | Gate (frozen) |

## Decisions

1. **Script ≠ skill.** Detection logic in a script for testability. Skill bodies cannot host assertions; scripts can. The skill just invokes the script.
2. **PR check uses `--state all`.** Merged PRs count as "not dormant" — a merged branch may still have a local worktree briefly, but it has a PR record. Only NO-PR worktrees are the failure mode.
3. **Age threshold 1 hour.** Tighter than 1 day — the dormant-028 incident was caught within ~18 hours. A 1-hour threshold catches a dropped baton quickly while avoiding noise during an actively-running `/do` session.
4. **Report placement.** Dormant warnings go ABOVE findings. If unresolved dormant specs exist, the retro should not proceed — it's a precondition violation, not a finding.
5. **Gate is a smoke test, not a unit test.** Detection involves filesystem + `gh` interaction. The smoke test sets up fixture data (stubbed `gh` response via env variable or monkey-patch) and asserts detector output behavior without pinning implementation internals.

## Out of scope

- No automatic resumption of dormant worktrees.
- No archiving or cleanup of dormant worktrees.
- No hook-level blocking when dormant worktrees exist.
- No UI changes to the retro report beyond the new preflight section.
