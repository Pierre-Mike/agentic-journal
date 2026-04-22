---
id: 031-your-computer-is-enough
title: Your computer is enough
status: archived
kind: writeup
gate: content/posts/your-computer-is-enough.mdx
created: 2026-04-22T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
archived: '2026-04-22'
---

## Intent

Publish a personal-voice blog post arguing that local-first AI tooling has crossed the threshold from "toy" to "good enough for ~99% of daily work," and that this should reshape how we design software — away from cloud-UI-thin-client, toward treating the user's CPU+GPU as a first-class compute substrate.

## Constraints

- Single file: `content/posts/your-computer-is-enough.mdx`
- Must follow the `Intent → Why → What → How` section convention matching this repo's existing posts
- Personal voice, opinion post — not a product review or tool survey
- Two concrete examples only: LM Studio + MLX + GLM-4 (orchestrator role); Voice Ink + GLM-4 (transcription reviewer)
- No benchmarks, no code samples, no model-name predictions, no tool comparisons
- MoE forward-looking paragraph bounded to one short paragraph inside How
- Frontmatter must include: `title`, `date`, `spec_id`, `summary`, `tags`, `required_sections`
- Tags: `[local-first, ai-tooling, agentic-engineering]`

## Acceptance criteria

- [ ] `content/posts/your-computer-is-enough.mdx` exists
- [ ] Frontmatter contains all required fields: `title`, `date`, `spec_id`, `summary`, `tags`, `required_sections`
- [ ] `required_sections: [Intent, Why, What, How]` is present in frontmatter
- [ ] All four sections (Intent, Why, What, How) are non-empty
- [ ] Post is written as a software-design argument, not a product review; tools appear as evidence, not subject
- [ ] Scope is narrow and first-person only; no tool surveys or comparisons

## Context

Companion to other opinion posts in this repo (`harness-self-improvement.mdx`, `evals-importance.mdx`). Same structural shape: `Intent → Why → What → How`. The thesis is a software-design argument — local compute is a first-class execution target — using the author's actual stack as lived proof.
