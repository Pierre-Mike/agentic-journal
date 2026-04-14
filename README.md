# agentic-journal

A personal blog + working laboratory for an agentic engineering journey. Every post is a spec. Every feature is a spec. The repo itself dogfoods the workflow.

## Principles

1. **Deterministic-first** — axioms enforced by hooks, lints, tests, CI. Skills only for genuine judgement.
2. **Spec-driven** — every change starts in `specs/active/` and ends in `specs/archive/`.
3. **One spec, one gate, one verdict** — every spec declares how "done" is verified.
4. **State via filesystem** — active vs archive is a directory, not a flag. Scripts compute, LLM consults.

See `AGENTS.md` for onboarding and `specs/constitution.md` for invariants.

## Stack

- **Astro** + MDX on **Cloudflare Workers** (static + SSR capable)
- **Bun** for tooling, **Biome** for lint/format, **Lefthook** for pre-commit
- **GitHub Actions** for CI + preview/prod deploys
- **Claude Code** harness in `.claude/` (hooks, agents, settings)

## Commands

```bash
bun install             # install deps
bun run dev             # Astro dev server
bun run build           # build for Cloudflare
bun run deploy          # deploy to Cloudflare Workers
bun run check           # full local gate: typecheck + lint + test + spec-lint
bun run spec:status     # list active/ready/blocked specs
bun run tasks:verify    # verify current spec's gate
```

## Workflow

1. `claude` opens a session
2. Invoke the `align` skill to draft a spec in `specs/active/NNN-slug/`
3. Spec's `gate:` field declares what "done" means (a test file path, a writeup, a lint rule)
4. Agents work through `tasks.md` until the gate is green
5. Archive: `bun scripts/spec-archive.ts NNN` → `git mv` to `specs/archive/`
6. Merge → GitHub Actions deploys to Cloudflare

## Spec kinds

| Kind | Gate is |
|---|---|
| `code` | a test file |
| `rule` | a lint rule + fixtures |
| `workflow` | a smoke script |
| `writeup` | a markdown file with required sections (blog posts live here) |

## Related

This repo implements principles from three handoffs in the companion `agentic` repo:
- `handoff-agentic-workflow-pillars.md`
- `handoff-spec-management.md`
- `handoff-spec-verification-gates.md`
