# Design

## Approach

Five small deterministic fixes land in a single workflow spec. A new smoke script `scripts/smoke-harness-fixes.ts` exercises the two behavioural changes (spec-guard, spec-complete) with real assertions — RED before fixes, GREEN after. Skill and doc edits ride along under the same gate.

## Files touched

- `.claude/hooks/spec-guard.ts` — add `findRepoRoot(filePath)` helper; prefer its result over `cwd` when resolving `specs/active/`
- `scripts/spec-complete.ts` — extract `resolveSpec(arg)` as a named export; resolution order: exact → suffix-match `NNN-<arg>` → error
- `scripts/smoke-harness-fixes.ts` — new; gate artifact
- `.claude/skills/do/SKILL.md` — §5 order swap, §8 echo line, Rules block wording
- `AGENTS.md` — one-line clarifier in Directory Structure

## Decisions

- **Repo root from filePath, not cwd** — walks up from `dirname(filePath)` until `.git` (file or dir) is found. Falls back to cwd if none. Handles git worktrees where `.git` is a file containing a gitdir pointer.
- **Suffix-match on slug** — `resolveSpec("evals-importance")` tries `specs/active/evals-importance` first, then scans for `specs/active/*-evals-importance`. Rejects ambiguous matches. Substring-anywhere was rejected as too loose.
- **Real-assertion RED** — smoke does the actual work pre-fix and reports specific failures, instead of a stubbed `exit 1`. Per-step signal during the fix loop.
- **Extract `resolveSpec` as a named export** — enables direct import from the smoke script without spawning a subprocess. Small testability win.
- **AGENTS.md over CLAUDE.md** — repo already uses AGENTS.md for onboarding. Creating CLAUDE.md would fork the same role across two files.

## Out of scope

- Anywhere-substring matching in `spec:complete`
- Hook refactor beyond the cwd bug (e.g., unifying `enforce.ts` dispatch, new protected paths)
- Constitution.md edits
- Any content or post changes
