# Design

## Approach

A pure helper recognises RED-spec commit subjects. The lefthook pre-commit
`typecheck` step shells out to it; if the helper exits 0 (skip), typecheck is
short-circuited. Otherwise typecheck runs as before.

```
git commit -m "spec(015): RED — title"
        |
        v
.git/COMMIT_EDITMSG written
        |
        v
lefthook pre-commit > typecheck
        |
        v
scripts/red-commit-gate.ts (pure)
   reads COMMIT_EDITMSG line 1
   shouldSkipTypecheck({ commitSubject })
        |
   ┌────┴────┐
   v         v
RED       not RED
exit 0    > bun run typecheck
```

Two artifacts:

- `scripts/red-commit-gate.ts` — pure fn + tiny CLI that reads the file and
  exits 0/1.
- `lefthook.yml` — wraps `typecheck` in
  `if bun scripts/red-commit-gate.ts; then exit 0; fi; bun run typecheck`.

## Files touched

- `scripts/red-commit-gate.ts` — new pure helper + CLI.
- `scripts/red-commit-gate.test.ts` — RED gate; nine-case matrix covering
  positive matches, case sensitivity, missing spec id, leading whitespace,
  empty subject, unrelated conventional commits.
- `lefthook.yml` — pre-commit `typecheck` command wrapped to consult the helper.
  All other commands and stages untouched.

## Decisions

- **Hook stage: pre-commit (read `.git/COMMIT_EDITMSG`).** NOT commit-msg.
  Typecheck conventionally lives in pre-commit; for `git commit -m` (the
  dominant flow including all subagent commits), the file is already written
  before pre-commit fires. Editor-flow falls through to typecheck (safe
  default).
- **Regex: `^spec\(\d+\): RED\b`.** Strict, anchored, case-sensitive. Blocks
  "REDESIGN", "Red", lowercase typos, missing spec ID. `\b` allows " — title"
  or "—title" suffix. A future RED-named feature would need a tiny rename — fair
  guard.
- **Scope: typecheck only.** Do NOT skip biome, spec-lint, or secret-scan on
  RED commits. Spec-lint must validate frontmatter even on RED. Secret-scan is
  a security gate. Biome rarely trips on RED states; add later if evidence
  emerges.
- **Bootstrap atomicity exception.** This spec's own RED commit can't yet
  benefit from the gate the spec is introducing. We sidestep the
  not-yet-implemented import problem by writing the helper as a typecheck-clean
  no-op stub first, then the test file. The stub typechecks; the RED tests
  fail at assertion. The remaining tasks iterate the stub to GREEN. We accept
  one final atomic commit for THIS bootstrap; every subsequent spec gets the
  documented RED→GREEN flow.

## Risks

- **Editor flow (no `-m`) skips the gate.** With editor flow,
  `.git/COMMIT_EDITMSG` is written AFTER pre-commit. The helper reads the
  pre-existing file (last commit's subject or template). This is the safe
  default: typecheck still runs. Documented in Decisions.
- **A future feature directory or commit prefix called "RED" is blocked.**
  Mitigated by the strict `^spec\(\d+\): RED\b` regex. Conventional commits
  outside `spec(N):` are immune.

## Out of scope

- Expanding the skip to biome / spec-lint / secret-scan (security and lint
  gates remain unconditional).
- Migrating to a `commit-msg` hook stage (would require duplicating the
  typecheck command and complicating the editor flow further).
- Auto-detecting editor-flow commits and re-checking after `.git/COMMIT_EDITMSG`
  is finalised (out-of-scope: pre-commit is the wrong hook for that).
- Alternative subject formats (e.g. `RED:` prefix, `[RED]`); the existing
  `spec(N): RED — title` convention is the only supported form.
