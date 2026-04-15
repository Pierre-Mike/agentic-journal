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
bun install                   # install deps
bun run dev                   # Astro dev server
bun run build                 # build for Cloudflare
bun run deploy                # deploy to Cloudflare Workers
bun run check                 # full local gate: typecheck + lint + test + spec-lint
bun run spec:status           # list active/ready/blocked specs
bun run spec:complete <slug>  # deterministic closer: tick, archive, commit
bun run tasks:verify          # verify current spec's gate
bun run worktree:open <slug>  # open worktree + branch for a spec
bun run worktree:close <slug> # after PR merged: remove worktree + delete branch
```

## Workflow

1. `claude` opens a session on a clean `main`
2. `/do <intent>` — align, open worktree, write RED spec, work to green, close, push branch, open PR
3. Human merges the PR on GitHub (CI gates the merge)
4. `bun run worktree:close <slug>` — remove worktree + local branch

Run `/retro` periodically — it turns observed repo signal into a new improvement spec via `/do`. That is the feedback loop.

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
