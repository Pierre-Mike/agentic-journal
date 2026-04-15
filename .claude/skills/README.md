# Skills

All skills used by this repo live here. The repo is standalone — no external skill sources.

## Vendored

| Skill | Role |
|---|---|
| `/do` | End-to-end entry point. Aligns, opens worktree, authors RED spec, works to green, closes, pushes, opens PR. Main stays clean. |
| `/retro` | Feedback pillar. Retrospective scan of traces + archive + merged PRs → authors an improvement spec via `/do`. |
| `align` | Shared-understanding interview. Invoked inside `/do` or standalone to explore before committing to a spec. |
| `expertise` | Persist learnings across sessions into CLAUDE.md / `expertise-refs/`. State lives with the repo. |
| `ts-axioms` | TypeScript judgement-level invariants beyond what Biome + tsconfig catch. |

## Conventions

- Skills live under `.claude/skills/<name>/`, each with a `SKILL.md` at minimum.
- Vendor copies are maintained manually — update when upstream changes, commit the diff.
- Skills that accumulate state (`expertise-refs/`) keep that state committed alongside the skill code.

## Adding a skill

1. Create `.claude/skills/<name>/SKILL.md`
2. Follow the standard frontmatter schema (name, description)
3. Document intent in this README
4. If the skill could be deterministic instead — it should be a script/hook/lint rule, not a skill. Deterministic-first.
