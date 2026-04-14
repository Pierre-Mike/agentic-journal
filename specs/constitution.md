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
| `code` | a test file (path in `gate:`) |
| `rule` | a lint rule + fixtures (path in `gate:`) |
| `workflow` | a smoke script (path in `gate:`) |
| `writeup` | a markdown file with required sections (path in `gate:`) |

Every spec must declare one `kind` and at least one `gate:`. No exceptions.

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
