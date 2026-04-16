---
id: 002-evals-importance
title: Evals are the gate for AI
status: archived
kind: writeup
gate: content/posts/evals-importance.mdx
created: 2026-04-16T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-16'
---

## Intent

Publish a post arguing that evaluations — versioned datasets, scorers, and run harnesses — are the load-bearing discipline of applied AI. Frame evals as the model-layer analogue of the blog's own spec-gate thesis: without a gate, "better" collapses into vibes.

## Constraints

- MDX file at `content/posts/evals-importance.mdx`
- Frontmatter: `spec_id: 002-evals-importance`, `required_sections: [Intent, Why, What, How]`
- Voice and structure consistent with `day-0-why-this-blog.mdx`
- Include one minimal pseudo-code eval block under "What" (6–10 lines)
- Tool-agnostic prose; at most one parenthetical aside naming tools
- Ties closing paragraph back to the spec-gate discipline the repo already enforces

### Non-goals

- Tool comparison or benchmark survey
- Worked example with real datasets
- Any change to listing page, layout, or build scripts

## Acceptance criteria

- [ ] `content/posts/evals-importance.mdx` exists
- [ ] Frontmatter sets `spec_id: 002-evals-importance`
- [ ] Frontmatter declares `required_sections: [Intent, Why, What, How]`
- [ ] All four required sections present as markdown headings
- [ ] `bun run tasks:verify` exits 0
- [ ] `bun run spec:lint` exits 0

## Context

Second writeup on the blog. Establishes evals as a first-class concept so later posts (agent-loop design, trace triage, regression-on-prompt-edit) can reference it without re-deriving the motivation.
