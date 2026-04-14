# Skills

All skills used by this repo live here. The repo is standalone — no external skill sources are required.

## Vendored

| Skill | Role |
|---|---|
| `align` | Author new specs in `specs/active/`. Writes the gate artifact first (TDD), then tasks. |
| `expertise` | Persist learnings across sessions into CLAUDE.md / `expertise-refs/`. State lives with the repo. |
| `ts-axioms` | TypeScript judgement-level invariants beyond what Biome + tsconfig catch — no `as` outside tests, narrow types, exhaustive switches, immutability. |

## Conventions

- Skills live under `.claude/skills/<name>/`, each with a `SKILL.md` at minimum.
- Vendor copies are maintained manually — update when upstream changes, commit the diff.
- Skills that accumulate state (`expertise-refs/`) keep that state committed alongside the skill code.

## Adding a skill

1. Create `.claude/skills/<name>/SKILL.md`
2. Follow the standard skill frontmatter schema (name, description, triggers)
3. Document intent in this README
4. If the skill could be deterministic instead — it should be a script/hook/lint rule, not a skill. Deterministic-first.
