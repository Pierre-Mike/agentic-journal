---
id: 030-retro-dormant-worktrees
title: Surface dormant in-flight worktrees in /retro preconditions
status: active
kind: workflow
gate: scripts/smoke-retro-dormant.ts
created: 2026-04-21
owner: main
depends_on:
  - 005-trace-scan
  - 011-trace-shape-v2
  - 027-dual-agent-tdd
supersedes: null
---

## Intent

The `/retro` skill must never run a retrospective without first checking whether a prior spec is parked in a worktree with no PR. On 2026-04-21 the user had to manually notice that spec 028-hook-block-observability had been sitting in `.agentic/worktrees/hook-block-observability` since 2026-04-20 with no open or merged PR — a dropped baton from the dual-agent TDD pipeline (spec-tester commits RED, spec-judge freezes the gate, but spec-implementer is never dispatched). The main repo's `specs/active/` directory appeared empty, creating a misleading "nothing in flight" signal. This spec adds a `scripts/retro-preflight.ts` script that detects these dormant worktrees deterministically and wires it into the `/retro` skill as a mandatory pre-Step-2 precondition check, surfacing any findings at the top of the retro report before any new spec can be authored.

## Constraints

- `scripts/retro-preflight.ts` must export `detectDormantWorktrees(): DormantSpec[]` where `DormantSpec = { slug: string; branch: string; worktree_path: string; age_days: number; last_commit_sha: string; last_commit_ts: string }`.
- A worktree is dormant iff: (1) path is under `.agentic/worktrees/`, (2) branch matches `^spec/.+$`, (3) no PR exists (`gh pr list --state all --head <branch> --json number` returns `[]`), (4) last commit is >1 hour old.
- CLI: `--json` flag prints machine-readable output; default prints human-readable text starting with `Dormant in-flight specs:` header, or empty string if none.
- Empty-set behavior: human-readable output is the empty string (no header when nothing to show).
- `.claude/skills/retro/SKILL.md` Step 2 must be amended to invoke `bun scripts/retro-preflight.ts` and inline its output at the top of the retro report.
- If preflight finds dormant worktrees, the retro must surface them before authoring any new spec.
- Detection logic lives in the script, not the skill file (skill bodies cannot host assertions).
- PR check uses `--state all` so merged PRs count as "not dormant".
- Age threshold is 1 hour (not 1 day) to catch dropped batons quickly without flagging mid-`/do` worktrees.
- Non-goal: no automatic resumption of dormant specs.
- Non-goal: no archiving of dormant worktrees.
- Non-goal: no hook-level blocking on dormant worktrees.
- Test affordance: `retro-preflight.ts` reads subprocess-override env vars `GIT_WORKTREE_LIST_FIXTURE` (newline-delimited `<path> <branch>` entries), `GH_PR_LIST_FIXTURE` (JSON object keyed by `<branch>+state=all` returning `gh pr list` arrays), and `GIT_LOG_FIXTURE` (JSON object keyed by worktree path returning `{sha, ts}`) when present; when absent it shells out to the real commands (`git worktree list --porcelain`, `gh pr list`, `git log -1`).

## Acceptance criteria

- [ ] `scripts/retro-preflight.ts` exists and exports `detectDormantWorktrees()` returning `DormantSpec[]`.
- [ ] `detectDormantWorktrees()` returns entries only for worktrees under `.agentic/worktrees/` on a `spec/*` branch with no PR and last commit >1 hour old.
- [ ] A worktree with an open PR is not flagged as dormant.
- [ ] A worktree with a merged PR is not flagged as dormant.
- [ ] A worktree on a non-`spec/*` branch is not flagged as dormant.
- [ ] A worktree whose last commit is <1 hour old is not flagged as dormant.
- [ ] CLI default output starts with `Dormant in-flight specs:` when dormant entries exist, or is empty string when none.
- [ ] CLI `--json` flag prints valid JSON array of `DormantSpec` objects.
- [ ] `.claude/skills/retro/SKILL.md` Step 2 invokes `bun scripts/retro-preflight.ts` and inlines its output at the top of the retro report.
- [ ] `scripts/smoke-retro-dormant.ts` exits 0 after implementation.

## Context

Deferred finding F5 from the 2026-04-21 retrospective: "spec 028 was parked in worktree with no PR, main repo showed no active specs — misleading precondition for /retro." Promoted to this spec.

Prior art:
- **005-trace-scan**: established the pattern of filesystem-scanning scripts with deterministic aggregate exports (see `scripts/trace-scan.ts`).
- **011-trace-shape-v2**: established the `renderHotFiles`/`renderBlocks` convention of returning empty string when no data to show.
- **027-dual-agent-tdd**: introduced the three-phase spec lifecycle (tester → judge → implementer) whose dropped-baton failure mode this spec detects.
