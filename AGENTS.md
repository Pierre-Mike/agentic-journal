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

1. **Intent** → human types what they want
2. **Spec** → invoke `align` skill → writes `specs/active/NNN-slug/` with `gate:`
3. **Tasks** → ordered checklist in `tasks.md`, each has `agent:`, `depends:`, `file_targets:`
4. **Execute** → subagent (`blog-lead`) picks next ready task, edits files
5. **Verify** → `bun run tasks:verify` runs the spec's gate → pass/fail
6. **Archive** → all tasks checked + gate green → `scripts/spec-archive.ts` moves to `specs/archive/`
7. **Deploy** → merge to `main` → GitHub Actions builds + deploys to Cloudflare

## Subagents

- `blog-lead` — the only domain subagent (this is a small repo)

## Skills

- `align` — author a spec from intent (writes the gate first)
- `expertise` — read/write persisted learnings
- `ts-axioms` — TypeScript invariants
- `deterministic-first` — classify enforcement layer (hook/lint/test/CI vs skill)

## What agents MUST NOT do

- Write code without an active spec
- Edit `content/posts/*.mdx` without a spec of kind `writeup` pointing at that file
- Manually `git mv` a spec between active and archive (use the script)
- Tick `- [x]` on a task without running `tasks:verify`
- Introduce new LLM-powered automation where a script would suffice (deterministic-first)

## Gate types

See `specs/constitution.md` §Gate Types. Always match kind to gate type.
