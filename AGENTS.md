# AGENTS.md

Onboarding for any agent entering this repository.

## Read First

1. `specs/constitution.md` — non-negotiable invariants
2. `README.md` — stack + workflow
3. `specs/active/` — current in-flight work (list via `bun run spec:status`)

## Non-negotiables

- **Every change starts as a spec** in `specs/active/NNN-slug/`. No spec = no change.
- **Every spec declares a `gate:`** in its frontmatter. The gate is the verdict.
- **Agents consult state, never decide state.** Lifecycle transitions run through scripts (`spec-archive.ts`), never manual file moves by an agent.
- **Protected paths**: `wrangler.toml`, `content/posts/*.mdx` (only editable via an active spec of kind `writeup`)
- **No `--no-verify`, no `--force` push, no `rm -rf`** — blocked in `.claude/settings.json`.

## Stack

- Astro + MDX, Cloudflare Workers, Bun, Biome, Lefthook
- TypeScript strict, `noUncheckedIndexedAccess`, `noExplicitAny: error`

## Directory Structure

```
agentic-journal/
├── .claude/          # harness config (settings, hooks, agents)
├── .github/          # CI + deploy workflows
├── specs/            # spec surface (constitution, _template, active, archive)
├── scripts/          # deterministic state/verification scripts
├── content/posts/    # blog posts (MDX) — each is a spec of kind:writeup
├── src/              # Astro pages, layouts, components
└── tests/            # global tests (colocated tests preferred for components)
```

## Workflow

Main always stays clean. All work happens in a worktree on a `spec/<slug>` branch. PRs are the integration point.

1. **Intent** → human types what they want
2. **`/do <intent>`** → align → open worktree → author RED spec → work to green → `spec:complete` → push branch → open PR
3. **Human merges the PR** on GitHub (CI gates the merge)
4. **`git pull && bun run sync`** → auto-detects every merged `spec/*` and removes its worktree + branch

For parallel work: invoke `/do` multiple times via the `Agent` tool in a single message. Each dispatch opens its own worktree on its own branch. No file conflicts until merge.

Periodically invoke **`/retro`** — retrospective scan of traces + archive + merged PRs, authors an improvement spec via `/do`.

Only the edits inside `/do`'s work loop are non-deterministic. Everything else (align, spec-lint, verify, tick, archive, commit, push, PR creation) is scripts or ceremonial git.

## Skills

- **`/do <intent>`** — the only command needed for a change. End-to-end: align, worktree, RED spec, work, close, push, PR.
- **`/retro`** — feedback pillar. Retrospective scan → improvement spec from traces + archive + PR history.
- `align` — shared-understanding interview (invoked inside `/do`, or standalone to explore).
- `expertise` — persist learnings across sessions.
- `ts-axioms` — TypeScript judgement-level invariants.

No subagents by default. For parallel `/do`, dispatch via the `Agent` tool — each worker runs in its own worktree.

## What agents MUST NOT do

- Edit files on `main` — all changes happen in a worktree on `spec/<slug>`
- Write code without an active spec
- Edit `content/posts/*.mdx` without a spec of kind `writeup` pointing at that file
- Manually `git mv` a spec between active and archive (use `spec-complete`)
- Tick `- [x]` themselves — `spec-complete` does this from git truth
- Merge PRs — humans merge
- Close worktrees before the PR is merged
- Introduce new LLM-powered automation where a script would suffice (deterministic-first)

## Gate types

See `specs/constitution.md` §Gate Types. Always match kind to gate type.
