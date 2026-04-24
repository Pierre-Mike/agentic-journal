# Design

## Approach

Add a `detectDuplicateIds(slugs: string[]) => { errors: string[] }` pure function to `scripts/spec-lint.ts`. The function receives a flat list of normalised slug strings (date prefix stripped from archive names), groups them by leading `\d+`, and emits `"duplicate spec id NNN: <slug-a>, <slug-b>"` for every NNN with more than one owner.

The `main()` function calls `detectDuplicateIds` after building the union of active and archive slugs, funnelling results into the existing `errors` array so that `process.exit(1)` fires automatically when duplicates are found.

Archive folder names follow the pattern `YYYY-MM-DD-NNN-slug`; stripping the leading date component (`\d{4}-\d{2}-\d{2}-`) before extraction normalises them to the same form as active slugs.

## Files touched

- `scripts/spec-lint.ts` — add `detectDuplicateIds()` export; wire into `main()`.
- `scripts/spec-lint.test.ts` — new `describe("detectDuplicateIds")` block (RED gate, authored in this spec).
- `specs/archive/2026-04-22-030-fold-judge-escalation/` → renamed to `specs/archive/2026-04-22-031-fold-judge-escalation/` + frontmatter `id:` updated.
- `specs/archive/2026-04-22-030-skip-judge-rule-workflow/` → renamed to `specs/archive/2026-04-22-032-skip-judge-rule-workflow/` + frontmatter `id:` updated.
- `specs/archive/2026-04-22-031-your-computer-is-enough/` → renamed to `specs/archive/2026-04-22-033-your-computer-is-enough/` + frontmatter `id:` updated.
- `specs/archive/2026-04-23-032-typed-gates-sibling-tests/` → renamed to `specs/archive/2026-04-23-034-typed-gates-sibling-tests/` + frontmatter `id:` updated.

## Decisions

**Decision 1: Union scope (active + archive), no grandfather clause.**
Active-only scope would fail to catch the existing `030` collisions and would allow a collision to be silently archived. Archive slugs have the same NNN uniqueness requirement. Grandfather clause rejected — weaker guarantee.

**Decision 2: Allocation-time hardening deferred.**
Spec-lint fires at pre-push / CI, not at `/do` Step 3 allocation time. A true prevention mechanism (advisory lock, atomic `mkdir`) is a distinct architectural decision requiring a separate spec. This spec adds the detection layer only.

**Decision 3: Pure function `detectDuplicateIds(slugs)`.**
Takes normalised slug strings rather than hitting the filesystem, keeping the function unit-testable without temp fixture setup. The `main()` caller is responsible for normalising archive names (strip date prefix) before passing them in.

## Risks

- Archive rename introduces a gap where `listArchivedIds()` could read both old and new folder names if a partial rename is committed. Mitigation: all four renames are committed atomically in one commit per task.

## Out of scope

- `/do` Step 3 atomic ID allocation hardening (deferred finding a).
- Hot-file detector cross-worktree blindness (deferred finding b).
- ToolBlocked canary verification (deferred finding c).
- Editing `.claude/skills/do/SKILL.md`.
