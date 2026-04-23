---
id: '032'
title: Typed gates and sibling tests
status: archived
kind: rule
gate:
  - path: scripts/spec-lint.test.ts
    level: unit
  - path: scripts/sibling-test-hook.test.ts
    level: unit
created: 2026-04-23T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-23'
---

## Intent

Making "ship a code change without real test coverage" structurally impossible requires two enforcement points. First, the `gate:` frontmatter for `kind: code` specs becomes a typed list of `{path, level}` entries where level distinguishes unit from integration/e2e — the harness rejects any `kind: code` spec that lacks at least one of each coverage tier. Second, a new pre-commit hook rejects any diff that adds or modifies a `src/`, `scripts/`, or `.claude/` TypeScript file without its sibling `*.test.ts` staged in the same commit — closing the window where an implementer can land code and promise to "add tests later."

## Constraints

- `gateEntries()` must accept both scalar gate (legacy, lifted to `[{path, level: "unit"}]`) and list gate (`[{path, level}]`).
- Invalid level string → lint error with named message `"unknown gate level '<x>'; expected unit|integration|e2e"`.
- Duplicate gate paths → lint error `"duplicate gate path '<x>'"`.
- `kind: code` specs missing ≥1 unit entry → lint error with named shape.
- `kind: code` specs missing ≥1 integration|e2e entry → lint error with named shape.
- `tasks-verify.ts` must run every gate entry, not just the first.
- Sibling-test hook scope: `src/**/*.ts`, `scripts/**/*.ts`, `.claude/**/*.ts`; skips `**/*.test.ts`, `scripts/smoke-*.ts`, `scripts/gates/*.ts`.
- Exemption mechanism: `// @no-test: <reason>` on line 1, reason must be non-empty.
- `// @no-test` with empty reason is rejected (not silently allowed).
- Hook wired into `lefthook.yml` pre-commit alongside existing commands.
- `specs/_template/proposal.md` updated to show list syntax.
- `specs/constitution.md` §4 updated to reflect list shape.
- Non-goals: no LLM-vibes judge rubric changes; no "new tests in gate" hook enforcing waterfall TDD; no retroactive test-filling of existing untested files.

## Acceptance criteria

- [ ] `gateEntries()` helper parses scalar → `[{path, level: "unit"}]` and list → `[{path, level}, ...]`
- [ ] `spec-lint` rejects a `kind: code` spec whose gate has only unit entries with a named error
- [ ] `spec-lint` rejects a `kind: code` spec whose gate has only integration/e2e entries with a named error
- [ ] `spec-lint` rejects a gate with an invalid level string
- [ ] `spec-lint` rejects a gate with duplicate paths
- [ ] `tasks-verify` runs every gate entry (not just the first)
- [ ] `sibling-test-hook` rejects a diff where `src/foo.ts` is staged without `src/foo.test.ts`
- [ ] `sibling-test-hook` rejects a diff where `scripts/foo.ts` is staged without `scripts/foo.test.ts`
- [ ] `sibling-test-hook` allows a diff where `src/foo.ts` has `// @no-test: <reason>` on line 1
- [ ] `sibling-test-hook` rejects a diff where `src/foo.ts` has `// @no-test` (empty reason)
- [ ] `sibling-test-hook` skips `**/*.test.ts`, `scripts/smoke-*.ts`, `scripts/gates/*.ts`
- [ ] `sibling-test-hook` wired into `lefthook.yml` pre-commit
- [ ] `specs/_template/proposal.md` shows typed gate list syntax
- [ ] `specs/constitution.md` §4 reflects the list shape

## Context

- Spec 016 (`red-commit-gate`) established the RED/GREEN discipline — gate files must exist in failing form before implementation. That spec proves the harness can enforce structural process rules.
- Spec 027 (`dual-agent-tdd`) separated spec-tester from spec-implementer to eliminate self-collusion. This spec tightens the remaining gap: even with dual-agent discipline, a `kind: code` spec with a single shallow gate file gives no structural guarantee that both unit and integration tiers are covered.
- Immediate trigger: observed during session planning that `gate:` was one scalar path, making it trivially satisfiable with a smoke test that never exercises unit logic. The typed list + sibling-test hook closes this structurally.
