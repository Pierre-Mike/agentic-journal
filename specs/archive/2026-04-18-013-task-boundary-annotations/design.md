# Design

## Approach

A task gains a `boundary: [glob, ...]` line in `tasks.md`. Two new pure functions live in `scripts/spec-lint.ts`:

1. `validateTaskSchema(task)` → `{ errors: string[]; warnings: string[] }` — schema checker, called by the top-level `main()` inside `spec-lint.ts` for every parsed task of every active spec.
2. `validateBoundary({ task, changedFiles, repoRoot })` → `{ ok: true } | { ok: false; offendingFiles: string[] }` — pure matcher, called by `scripts/tasks-verify.ts` (or wherever git-diff truth is available).

Matching uses `Bun.Glob`. Union semantics: a changed file passes if ANY boundary glob matches.

## Files touched

- `specs/_template/tasks.md` — document and demo the `boundary:` field.
- `scripts/spec-lint.ts` — parse tasks.md per active spec, run `validateTaskSchema`, surface errors + warnings; export both pure functions.
- `scripts/spec-lint.test.ts` — colocated tests for `validateBoundary` and `validateTaskSchema`; doubles as the `kind:rule` gate artifact (default export runs `bun test` on itself).
- `scripts/tasks-verify.ts` — per-task: load parsed tasks, intersect with `git diff`, invoke `validateBoundary`, fail with offender list.

## Data shape

```ts
interface ParsedTask {
  index: number;           // line index in tasks.md
  title: string;
  file_targets: string[];
  boundary?: string[];     // NEW — undefined permitted (backward compat)
}
```

## Decisions

- **Escape hatch `boundary: ["*"]`** — accepted, no error or warning. `Bun.Glob("*")` matches a single path segment. We convert `"*"` to `"**"` internally so the escape hatch truly matches any path.
- **Backward compat** — missing `boundary:` emits a deprecation warning from `validateTaskSchema`; `spec-lint.ts` prints warnings but does NOT exit non-zero on warnings. This keeps existing in-flight specs passing while encouraging migration.
- **Empty boundary `[]`** — treated as "no files allowed". Still passes schema (warning only: "did you mean `['*']`?"). The boundary validator correctly reports all changed files as offenders.
- **Union semantics across globs** — changed file passes if matched by ANY glob. Intersection would be surprising.
- **Glob implementation** — `Bun.Glob` (no extra dep). Matched against the repo-relative POSIX path of each changed file.
- **Integration point** — `scripts/tasks-verify.ts` is the natural gate runner. It already enumerates active specs; adding a boundary check there keeps `bun run tasks:verify` as the single "am I done?" command. `scripts/spec-complete.ts` already runs `tasks-verify`, so the wiring propagates for free.
- **Git diff surface** — `tasks-verify.ts` only enforces the boundary on tasks whose `file_targets` appear in the working-tree diff since spec creation; tasks not yet touched are skipped. This mirrors `spec-complete.ts` behavior.
- **Parsing reuse** — `scripts/spec-complete.ts` already parses tasks.md; we extract the parser into `spec-lint.ts` (or a tiny sibling) so both consumers use the same shape. Keeping it colocated in `spec-lint.ts` avoids a third file.

## Risks

- **False positives from over-wide diffs** — if a task accidentally shares `file_targets` with another, the boundary of the first might be enforced against a diff the second produced. Mitigation: `tasks-verify` only checks a task's boundary if THAT task's own `file_targets` appear in the diff; we diff only `task.file_targets` to scope the check.
- **Glob footguns** — `Bun.Glob("scripts/*.ts")` does NOT match `scripts/sub/nested.ts` (single segment `*`). Documented in the template.

## Out of scope

- Rewriting archived `tasks.md` files — they're frozen.
- Integrating boundary output into the `/do` SKILL.md narrative — separate spec.
- Adding semantics beyond the existing `depends:` field — just keep it.
- A CI check that every new spec uses `boundary:` — today is warning-only.
