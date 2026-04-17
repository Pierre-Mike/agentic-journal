---
id: 007-harness-self-improvement
title: A harness that improves itself
status: active
kind: writeup
gate: content/posts/harness-self-improvement.mdx
created: 2026-04-17
owner: main
depends_on: []
supersedes: null
---

## Intent

Publish a post arguing that a harness without logs → feedback → retros is a harness rotting in place. The triad is the self-correcting mechanism that turns friction into permanent improvement. Without it, agentic workflows drift; with it, every papercut becomes next week's axiom.

## Constraints

- MDX at `content/posts/harness-self-improvement.mdx`
- Frontmatter sets `spec_id: 007-harness-self-improvement`
- Frontmatter declares `required_sections: [Intent, Why, What, How]`
- Voice matches `content/posts/day-0-why-this-blog.mdx` and `content/posts/evals-importance.mdx`
- Target length ~700–900 words
- "How" section is anchored in the retro-of-retro anecdote, not generic enumeration
- Cites specs 004 (delegate /do to subagent) and 005 (trace-scan) by id where the argument needs evidence
- No first-person "I"; no emojis; concrete verbs over adjectives

## Non-goals

- Tool comparisons (no LangGraph-vs-LangChain, no framework endorsements)
- Enumeration that reads like documentation
- Any change to the listing page, layout, or build scripts

## Acceptance criteria

- [ ] `content/posts/harness-self-improvement.mdx` exists
- [ ] Frontmatter sets `spec_id: 007-harness-self-improvement`
- [ ] Frontmatter declares `required_sections: [Intent, Why, What, How]`
- [ ] All four required sections present as markdown headings
- [ ] `bun run tasks:verify` exits 0
- [ ] `bun run spec:lint` exits 0

## Context

Third writeup on the blog, following 000 (day-0-why-this-blog) and 002 (evals-importance). Same writeup-gate shape. This post makes the feedback triad explicit so later posts (harness evolution case studies, retro pattern library) can reference it without re-deriving. The retro-of-retro anecdote is live evidence: /retro read `.claude/traces/` and found nothing in the repo consumed them, shipped spec 005-trace-scan as the fix. The loop closed on itself.
