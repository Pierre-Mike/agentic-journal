---
id: 018-tdd-importance
title: TDD is the discipline that scales with author velocity
status: active
kind: writeup
gate: content/posts/tdd-importance.mdx
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 002-evals-importance
  - 016-red-commit-gate
supersedes: null
---

## Intent

Publish a post arguing that test-driven development isn't a quaint relic — it's
the only discipline that keeps both human-written and LLM-written code from
rotting, because the test is what lets you tell "I changed it" from
"I improved it." The same shape repeats at three layers: the unit test for
classical code, the spec gate for spec-first work, the eval for AI systems.
LLM authorship doesn't kill TDD — it makes TDD load-bearing, because a falsifiable
claim before the change is the only filter that holds when an agent emits
1000 plausible diffs/hour.

## Constraints

- MDX file at `content/posts/tdd-importance.mdx`
- Frontmatter exactly matches the file shape: `title`, `date: 2026-04-19`,
  `spec_id: 018-tdd-importance`, `summary`, `tags: [tdd, agentic-engineering, evals]`,
  `required_sections: [Intent, Why, What, How]`
- Body has 4 H2 sections matching `required_sections`
- Length 700–900 words
- Exactly 2 ASCII diagrams (1 in Why, 1 in What)
- 3 internal links to other posts (`evals-importance`, `day-0-why-this-blog`,
  `harness-self-improvement`)
- 0 external links (no `https://` or `http://` in the body)
- 0 code samples
- Tone matches `evals-importance.mdx` and `harness-self-improvement.mdx` —
  opinionated, dense, arguments-first
- One concrete reference to spec 016 (RED commit / typecheck bypass) as the
  worked example
- One paragraph engaging the classical-TDD-orthodoxy critique
  (DHH "TDD is dead", Coplien "Why Most Unit Testing Is Waste") then
  reframing — premises evaporate under LLM authorship

### Non-goals

- Relitigating the 2014 TDD-is-dead debate beyond one paragraph
- Adding more spec IDs as references — turns post into changelog
- Reproving the evals thesis — link `evals-importance` instead
- Any code/script changes; modifying existing posts; adding tag-page templates;
  modifying tags index

## Acceptance criteria

- [ ] `content/posts/tdd-importance.mdx` exists with valid frontmatter
      (title, date, spec_id, summary, tags, required_sections)
- [ ] Body has 4 H2 sections matching required_sections: Intent, Why, What, How
- [ ] Word count between 700 and 900
- [ ] Exactly 2 ASCII diagrams (count fenced blocks containing `┌` or `─` or `↓`)
- [ ] At least 3 internal links to other posts in `/posts/`
      (`evals-importance`, `day-0-why-this-blog`, `harness-self-improvement` slugs)
- [ ] 0 external links (no `https://` or `http://` in the body)
- [ ] One concrete reference to spec 016 (RED commit / typecheck bypass) —
      verify by grep
- [ ] One paragraph engaging the TDD-orthodoxy critique
      (search for "DHH" OR "Coplien" OR "TDD is dead" OR "ceremony")
- [ ] `bun run check` passes
- [ ] `bun run spec:lint` passes
- [ ] `bun run tasks:verify` reports green for 018-tdd-importance

## Context

Depends on 002-evals-importance (the AI-layer parallel this post links to —
evals are the model-layer instance of the same falsifiable-claim-before-change
discipline) and 016-red-commit-gate (the concrete repo example this post cites
as TDD's red→green→refactor visible in git history). Authored 2026-04-19 as
the next blog post.
