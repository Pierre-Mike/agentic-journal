# Blocker: spec 037 — Refactor pass after green for kind:code (implementer)

## Status
Implementer stuck at 2026-04-26T00:00:00Z.

## Reason
The primary task (Task 1) requires editing `.claude/agents/spec-implementer.md`, but the Claude Code permission system denies both Write and Edit to that path. The `.claude/settings.json` allowlist permits writes only to `.claude/hooks/**` and `.agentic/worktrees/**/.claude/hooks/**` — it does not include `.claude/agents/**`. The pre-tool-use hook is irrelevant here; the denial comes from Claude Code's own permissions layer before the hook runs. Neither Edit nor Write succeeds on `.claude/agents/spec-implementer.md`.

## Last state
- Task in flight: "Add Step 6.5 Refactor pass section to spec-implementer.md"
- Attempts on that task: 2 (Edit denied, Write denied)
- Last `tasks:verify` output (tail):
  smoke-implementer-refactor: RED — spec 036 not yet implemented
  ✖ 037-refactor-pass-after-green (workflow) — workflow smoke failed: scripts/smoke-implementer-refactor.ts
  error: script "tasks:verify" exited with code 1

## Worktree
Path: /Users/pierre-mikel/Github/agentic-journal/.agentic/worktrees/refactor-pass-after-green
Branch: spec/refactor-pass-after-green
HEAD: 136bc44daf87fd157ca5f9b7c56073ae2fca5309

## Resume paths
1. Add `"Edit(.claude/agents/**)"` and `"Write(.claude/agents/**)"` (or the specific path `"Edit(.claude/agents/spec-implementer.md)"` / `"Write(.claude/agents/spec-implementer.md)"`) to the `permissions.allow` array in `.claude/settings.json`, then re-run `/do refactor-pass-after-green` — the implementer will be able to write the Step 6.5 section on the next dispatch.
2. Edit `.claude/agents/spec-implementer.md` manually in your own session (add the Step 6.5 section per design.md), then re-run `/do refactor-pass-after-green` — the implementer starts at Task 2 (smoke assertions) which only targets `scripts/smoke-implementer-refactor.ts`.
3. Close the PR (if open) and abandon the worktree via `bun scripts/worktree-close.ts refactor-pass-after-green`.
