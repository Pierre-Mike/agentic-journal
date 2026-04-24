# Design — 032 Typed gates and sibling tests

## Approach

Two enforcement points, one spec.

**Rule 1 — Typed gate list.** `gate:` in proposal.md frontmatter becomes a list of `{path, level}` entries (level in {unit, integration, e2e}). `scripts/_lib.ts` gains a `gateEntries()` helper that parses either scalar (legacy) or list. `scripts/spec-lint.ts` enforces, for `kind: code`: ≥1 entry with `level: unit` AND ≥1 entry with `level: integration|e2e`. `scripts/tasks-verify.ts` runs every gate entry. Enforced at pre-commit (spec-lint) and pre-push (tasks-verify).

**Rule 2 — Sibling-test diff hook.** New `scripts/sibling-test-hook.ts` reads `git diff --cached --name-only --diff-filter=ACMR`. For every staged `.ts` under `src/`, `scripts/`, or `.claude/` that is not a test/smoke/gate file and does not have a `// @no-test: <reason>` first-line annotation, requires the sibling `*.test.ts` in the same directory to be staged in the same commit. Rejects with an explicit error listing offenders. Wired into `lefthook.yml` as a pre-commit command.

**Self-gate for THIS spec**: fixture cases exercised by `scripts/spec-lint.test.ts` (extended) and `scripts/sibling-test-hook.test.ts` (new, colocated). Fixtures are in-memory strings / arrays — no temp dirs, no real git ops.

## Files touched

- `scripts/_lib.ts` — add `gateEntries()` helper, `GateEntry` type, update `SpecFrontmatter.gate` to include object-list shape
- `scripts/_lib.test.ts` — unit tests for `gateEntries()` (may be new file)
- `scripts/spec-lint.ts` — extend with level-coverage check, invalid-level check, duplicate-path check
- `scripts/spec-lint.test.ts` — extend with new fixture cases (RED gate file for this spec)
- `scripts/tasks-verify.ts` — iterate every `gateEntries()` entry instead of only `gatePaths()`
- `scripts/sibling-test-hook.ts` — new file, reads staged diff and enforces sibling test rule
- `scripts/sibling-test-hook.test.ts` — new test file, in-memory fixtures (RED gate file for this spec)
- `lefthook.yml` — add `sibling-test` command to `pre-commit` block
- `specs/_template/proposal.md` — show list syntax, comment that scalar is legacy
- `specs/constitution.md` — §4 update "Gate is one file" to "Gate is one or more test files; `kind: code` requires ≥1 unit + ≥1 integration|e2e"

## Decisions

**1. Exemption mechanism for sibling-test rule** — magic comment `// @no-test: <reason>` on line 1, with mandatory non-empty reason. Rejected: filename pattern (`*.types.ts`, `index.ts`) conflates name with content; AST heuristic overkill for pre-commit; comment without reason too easy to sprinkle. Grep `rg '@no-test'` surfaces every exemption in the repo for future `/retro` audits.

**2. Hook scope** — `src/**/*.ts`, `scripts/**/*.ts`, `.claude/**/*.ts`. Path-pattern skips for `**/*.test.ts`, `scripts/smoke-*.ts`, `scripts/gates/*.ts`. Rejected: `src/` only (misses where mistakes actually happen — `scripts/` holds most of the TS in this repo); every `.ts` anywhere (false positives on `astro.config.ts`, root-level dev scripts); JSON-configured scope (config-apart-from-enforcement is forgettable).

## Out of scope

- No LLM-vibes judge rubric changes.
- No "new tests in gate" hook that enforces waterfall TDD ordering (spec-tester writes gate → spec-implementer writes impl is already the architecture).
- No retroactive test-filling of existing untested files in `src/` or `scripts/`.

## Bootstrap note

**Option A chosen.** This spec uses scalar `gate: scripts/spec-lint.test.ts` in proposal.md frontmatter. The second gate file (`scripts/sibling-test-hook.test.ts`) is declared via design.md and tasks.md rather than via the new list syntax. This avoids a circular dependency: if we used the new list syntax here, `spec-lint` would need to parse that syntax to validate our own proposal.md — but `gateEntries()` doesn't exist yet until this spec is implemented. Option A keeps the RED commit clean.
