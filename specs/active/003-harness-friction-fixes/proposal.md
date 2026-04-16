---
id: 003-harness-friction-fixes
title: Close /do friction gaps
status: active
kind: workflow
gate: scripts/smoke-harness-fixes.ts
created: 2026-04-16
owner: main
depends_on: []
supersedes: null
---

## Intent

Close the friction gaps observed running `/do` for specs 001 and 002 so the loop runs end-to-end without workarounds. Specifically: make the pre-tool-use write guard work when edits land inside a worktree, make `spec:complete` accept a plain slug, correct the skill's internal step order to match hook semantics, and add a confirmation echo after the silent `gh pr merge --auto` dispatch.

## Constraints

- All changes land deterministically; no new LLM calls
- No regression for current behavior: exact `<id-slug>` argument to `spec:complete` must keep working
- `activeSpecTargetsFile` must continue working when cwd and filePath share a root (existing callers)
- Smoke script lives at `scripts/smoke-harness-fixes.ts`, exits 0 only after all fixes are applied
- No changes to `specs/constitution.md` — only the skill's procedural order drifts

### Non-goals

- Substring/anywhere fuzzy matching in `spec:complete` (suffix-match on slug only)
- New hook categories or new protected paths
- Changes to `tasks-verify.ts`, `spec-archive.ts`, `spec-lint.ts`
- A CLAUDE.md file (AGENTS.md already anchors the repo layout)

## Acceptance criteria

- [ ] `scripts/smoke-harness-fixes.ts` exists and `bun scripts/smoke-harness-fixes.ts` exits 0
- [ ] `.claude/hooks/spec-guard.ts` resolves the enclosing repo root by walking up from `filePath` (falls back to cwd when no `.git` is found)
- [ ] `scripts/spec-complete.ts` exports a `resolveSpec(arg: string): string | null` helper and accepts both `<id-slug>` and `<slug>` as its argv
- [ ] `.claude/skills/do/SKILL.md` §5 reorders to: 5a proposal.md → 5b gate artifact (RED) → 5c design.md → 5d tasks.md; §8 emits `✓ auto-merge queued` after the `gh pr merge --auto` dispatch; Rules "Gate first, always" rewritten to "Spec first, gate second"
- [ ] `AGENTS.md` Directory Structure section adds one line clarifying that `src/content/` is intentionally empty — posts live at root `content/posts/`
- [ ] `bun run spec:lint` exits 0

## Context

Friction surfaced in the retrospective on spec 002: had to bypass the `Write` hook via Bash heredoc because the pre-tool-use guard resolved `specs/active/` from the main repo's cwd, not the worktree where the spec was authored. `spec:complete evals-importance` rejected a slug the skill says is accepted. Skill §5a says "gate first" but the hook refuses post writes without an active spec — the order is backwards in practice.
