# specs/

The spec surface. Every change to this repo passes through here.

## Layout

```
specs/
├── constitution.md     # invariants (read this first)
├── _template/          # skeleton for new specs
├── active/             # in-flight changes
└── archive/            # completed changes (YYYY-MM-DD-NNN-slug)
```

## Lifecycle

```
draft (in author's head)
    │
    │  align skill writes spec
    ▼
active/NNN-slug/        ← state: in progress
    │
    │  all tasks checked + gate green
    │  scripts/spec-archive.ts
    ▼
archive/YYYY-MM-DD-NNN-slug/   ← state: done, audit trail
```

## Creating a new spec

1. Copy `_template/` to `active/NNN-slug/` (next available NNN)
2. Fill `proposal.md` (the WHY)
3. Declare `kind` and `gate:` in frontmatter
4. Write the gate artifact (test file, writeup, lint rule) — RED first
5. Fill `tasks.md` with ordered, typed tasks
6. `bun run spec:lint` to validate

## Spec kinds

| Kind | Gate is | Example |
|---|---|---|
| `code` | test file | "add RSS feed endpoint" |
| `rule` | lint rule + fixtures | "ban `as` casts in `src/`" |
| `workflow` | smoke script | "add preview deploy on PR" |
| `writeup` | markdown with required sections | "blog post: Day 0" |

## Rules

- One `kind` per spec. Split compound work into a parent + children.
- One `gate:` per spec (may be a list of paths).
- `depends_on:` is the only legitimate ordering mechanism between specs. Cycles fail `spec:lint`.
- Archived specs are immutable. Amendments become a new spec with `supersedes:`.

## Commands

```bash
bun run spec:status     # list active/ready/blocked
bun run spec:lint       # validate frontmatter + DAG
bun run tasks:verify    # run current spec's gate
```
