# Constitution

Invariants that govern every change in this repository. Referenced by `AGENTS.md` and enforced by hooks/lints/CI wherever possible.

## 1. Spec-first

- No change to production code or content without an active spec in `specs/active/NNN-slug/`.
- Every spec has a single `gate:` in its frontmatter declaring how "done" is verified.
- Gates are verified by `scripts/tasks-verify.ts`, never by human judgement alone.

## 2. Deterministic-first

If an axiom, rule, or transition can be checked deterministically, it MUST NOT be a skill.

| Axiom type | Enforcement |
|---|---|
| Syntactic / structural | Biome, TypeScript |
| Path / behavioral | `.claude/hooks.ts` |
| Test-expressible | colocated `*.test.ts` |
| Workflow ordering | Lefthook, GitHub Actions |
| Genuine judgement (ambiguous) | skill — last resort |

## 3. State via filesystem

- Active vs archive is a directory, not a frontmatter flag.
- `scripts/spec-status.ts` computes ready / blocked / active from filesystem alone.
- Lifecycle transitions happen via scripts (`spec-archive.ts`), never by agents moving files directly.

## 4. Spec kinds and gates

| Kind | Gate is |
|---|---|
| `code` | per-task `gate:` fields in `tasks.md` (slice-RED TDD, one gate per task) |
| `rule` | a lint rule + fixtures (scalar or single-entry list in `gate:`) |
| `workflow` | a smoke script (scalar or single-entry list in `gate:`) |
| `writeup` | a markdown file with required sections (scalar or single-entry list in `gate:`) |

Every spec must declare one `kind` and at least one `gate:`. No exceptions.

### Slice-RED TDD (kind: code only)

`kind: code` specs use per-slice red-green-refactor TDD. Each task in `tasks.md` declares its own `gate:` field — the gate file the spec-tester writes in failing form for that slice. The spec-judge reviews each slice gate and writes `.gate-frozen-N` (zero-byte sentinel) on PASS, where N is the task ordinal (1-indexed, contiguous).

```
specs/active/<id>/
  .gate-frozen-1   ← spec-judge approved slice 1
  .gate-frozen-2   ← spec-judge approved slice 2
  .gate-frozen-N   ← spec-judge approved slice N
```

Rules:
- Gate paths must be unique within the spec; ordinals 1..N must be contiguous.
- `spec-complete` requires all `.gate-frozen-1` through `.gate-frozen-N` to be present.
- `tasks-verify` skips unfrozen slices (RED is correct); enforces only frozen slices.
- The hook (`enforce.ts`) blocks writes to a slice's gate path when `.gate-frozen-N` exists. Bare `.gate-frozen` (no ordinal) is inert — never created, never read.
- Non-code specs (rule/workflow/writeup) do NOT use per-task `gate:` fields; they keep the legacy single-gate batch-RED path (no judge, no slice sentinels).

`kind: code` tasks.md example:
```markdown
- [ ] 1. First task
  - gate: src/foo.test.ts
  - file_targets: [src/foo.ts]
  - boundary: [src/foo.ts, src/foo.test.ts]
```

The proposal-level `gate:` for kind:code is a human-readable derived summary of per-task gates; it is NOT a source of truth and is not enforced by spec-lint.

Other kinds accept a scalar path (legacy) or a single-entry list in the proposal-level `gate:`. The scalar form is lifted to `[{path, level: "unit"}]` internally.

## 5. TypeScript axioms

- `strict: true`, `noUncheckedIndexedAccess: true`
- **No `any`** — `noExplicitAny: error` in Biome
- **No `as` casts** outside test files — use schema validation, type narrowing, or brand constructors
- **Named parameters** for functions with 3+ arguments
- **Immutability by default** — `readonly`, `as const`

## 6. Content axioms

- Blog posts live in `content/posts/` as MDX.
- Every post's frontmatter references its originating spec: `spec_id: NNN-slug`.
- Agents may not edit `content/posts/*.mdx` without an active spec of kind `writeup` whose `file_targets` includes that post.

## 7. Deploy axioms

- Deploy to production only from `main` after all gates pass.
- Preview deploy on every PR.
- `wrangler.toml` is a protected file — edits require an active spec.

## 8. Test axioms

- Colocated tests preferred: `foo.ts` → `foo.test.ts` in the same directory.
- A spec's gate test file lives at its permanent code location — no duplicate test trees under `specs/`.

## 9. Observability axioms

- Every tool call flows through `.claude/hooks.ts`.
- Hooks emit structured events to `.claude/traces/<session_id>.jsonl` (gitignored).
- Traces are the source of truth for what happened; logs are not.

## 10. Escalation

Any agent hitting an ambiguous axiom, a violated invariant, or a non-deterministic path MUST stop and escalate (emit a GitHub issue with `needs-human-review` label). Never guess past an invariant.
