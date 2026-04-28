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
| `code` | outer gate (`proposal.md` frontmatter `gate:`) + per-task `gate:` fields in `tasks.md` (slice-RED TDD) |
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

The proposal-level `gate:` for kind:code is the **outer gate** (BDD acceptance test, source of truth, enforced by spec-complete). Per-task gates in `tasks.md` are the per-slice gates.


### Outer gate (kind: code)

For `kind: code` specs, the `gate:` field in `proposal.md` frontmatter is the **outer gate** — a BDD acceptance test scoped to `alignment.md` that verifies the spec's integrated behavior. This is distinct from per-slice gates:

- **Outer gate** (`proposal.md` frontmatter `gate:`): tests the spec as a whole; scaffolded at Step 5; reviewed by spec-judge against `alignment.md`; must be GREEN before archive.
- **Per-slice gates** (`tasks.md` per-task `gate:`): test individual slice boundaries; one per task; reviewed by spec-judge per slice; each must be GREEN and frozen (`.gate-frozen-N`) before archive.

The outer gate catches integration gaps where per-slice gates all pass but the spec's stated outcome is broken.

Sentinels:
```
specs/active/<id>/
  .gate-frozen-outer  ← spec-judge approved outer gate
  .gate-frozen-1      ← spec-judge approved slice 1
  .gate-frozen-N      ← spec-judge approved slice N
```

`spec-complete` requires **both** `.gate-frozen-outer` AND all `.gate-frozen-1` through `.gate-frozen-N` to be present before archiving a kind:code spec.
Other kinds accept a scalar path (legacy) or a single-entry list in the proposal-level `gate:`. The scalar form is lifted to `[{path, level: "unit"}]` internally.

### Post-slice re-plan (kind: code only)

After each slice's refactor commit lands, `/do` dispatches `spec-replanner` (haiku) before the next slice's `spec-tester`. The replanner reads the slice's diff and decides whether to patch `tasks.md` for downstream slices.

Three possible outcomes per slice, all exit 0:

- **No-op (most common)** — no commit, slice N+1 uses the original plan
- **Patch** — commit `replan(<id>): <next-affected-slice-index>`. Replanner edited `tasks.md` and APPENDED to `design.md` "Replanning notes". `tasks.md` is the only mid-spec mutable plan artifact; `proposal.md`, `alignment.md`, gate files, and existing `design.md` content are immutable post-scaffold.
- **Soft escalation** — commit `replan(<id>): escalation — slice N` containing `replan-escalation.md`. The deviation was too large to auto-patch. The file surfaces in PR review; `/do` continues to the next slice without blocking.

Scope guard: the replanner has Read/Edit on the spec folder only and Bash limited to `git diff`/`log`/`show`/`add`/`commit`. It cannot mutate source code, gate files, sentinels, or any non-spec path. See `.claude/agents/spec-replanner.md` for the full contract.

### Auto-pilot mode (`/do-auto`)

`/do-auto <intent>` is the headless variant of `/do`. It replaces the interactive `align` interview with the `auto-aligner` subagent (sonnet, single-shot) plus an ambiguity gate.

Flow:

```
intent → auto-aligner → .agentic/last-alignment.md
                          │
                          ├─ status: confirmed + confidence: high
                          │     → /do-auto runs Steps 3-10 (worktree, scaffold,
                          │       slice loop, close, push, PR)
                          │
                          └─ status: needs-human (or confidence: low)
                                → /do-auto exits 0 without scaffolding;
                                  morning digest surfaces the row
```

The `auto-aligner` writes to a single mailbox path (`.agentic/last-alignment.md`, same as the human-driven `align` skill from spec 043). Frontmatter schema is shared and validated by `scripts/check-alignment-mailbox.ts`. `/do-auto` reads the mailbox via `scripts/do-auto-branch.ts` (`parseAlignmentAndBranch`) and branches deterministically.

Hard rules:
- **Auto-aligner is the only judgment point** — `/do-auto` never scaffolds without first dispatching it
- **`needs-human` is non-blocking** — `/do-auto` exits 0; no worktree opens; nothing on `main`
- **No human prompts** — every step that would prompt in `/do` either succeeds via the aligner's confidence assessment or soft-escalates to a sidecar artifact

Headless invocation: `claude -p --max-turns 100 "/do-auto <intent>"`. See `.claude/skills/do-auto/SKILL.md` for the full skill and `.claude/agents/auto-aligner.md` for the aligner's contract.

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
