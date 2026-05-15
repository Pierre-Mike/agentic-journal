---
id: 121-templated-engineering
title: Templated engineering
status: archived
kind: writeup
gate: content/posts/templated-engineering.mdx
created: 2026-05-15T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-05-15'
---

## Intent

Publish a personal-voice blog post arguing that the unit of engineering output has shifted from code to the template that produces code. Code is downstream of the template. The post names "templated engineering" as the practice — treating the spec, gate, and scaffold as primary artifacts, with code as a derived diff — and uses this repository as lived proof.

## Constraints

- Single file: `content/posts/templated-engineering.mdx`
- Four sections in order: `Intent → Why → What → How` — matching `harness-self-improvement.mdx` and `your-computer-is-enough.mdx`
- Opinion post, personal voice — not a tool survey or product review
- Target length: ~5K–6K characters, opinionated, concrete, no bullet-soup prose
- No external link citations in the body — sources inform framing, do not appear
- Industry names (GitHub Spec Kit, AWS Kiro, Tessl, Claude Code skills) appear as evidence, not subject
- Fowler's three-level taxonomy (spec-first, spec-anchored, spec-as-source) named, not linked
- Frontmatter must include: `title`, `date`, `spec_id`, `summary`, `tags`, `required_sections`
- Tags: `[agentic-engineering, spec-driven-development, templates]`

## Acceptance criteria

- [ ] `content/posts/templated-engineering.mdx` exists
- [ ] Frontmatter contains all required fields: `title`, `date`, `spec_id`, `summary`, `tags`, `required_sections`
- [ ] `required_sections: [Intent, Why, What, How]` is present in frontmatter
- [ ] All four sections (Intent, Why, What, How) are non-empty H2 headings
- [ ] Post argues a single thesis (template-as-primary-artifact) rather than surveying tools
- [ ] No external links in the body

## Context

Companion to `harness-self-improvement.mdx` (the harness's self-correction loop) and `your-computer-is-enough.mdx` (local compute as design surface). Same structural shape. The thesis is the next layer up from the harness post: if the harness is a loop that improves itself, the template is the artifact the loop is improving. The industry has been converging on this — GitHub Spec Kit, AWS Kiro, Tessl, Claude Code skills are all the same shape — but practitioners lack a clean name for what they are doing. The post names it.
