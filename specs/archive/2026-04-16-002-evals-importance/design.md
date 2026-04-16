# Design

## Approach

Author a single MDX post. The writeup gate drives doneness: four required headings (`Intent`, `Why`, `What`, `How`) must appear. RED state is a stub MDX with frontmatter only; GREEN fills the sections.

## Files touched

- `content/posts/evals-importance.mdx` — new post; gate artifact

## Decisions

- **Concrete pseudo-code under "What"** — 6–10 lines showing `(input, expected) → score`. Prose alone leaves evals abstract; a worked example derails the manifesto voice.
- **Tool-agnostic with one aside** — keeps the thesis portable. One parenthetical ("pick any: Inspect, promptfoo, a 50-line script") signals awareness without aging the post.
- **Four sections, not three** — `Intent / Why / What / How`. `How` carries the "start crude, earn complexity" point, which is the most actionable takeaway.
- **Close by tying to spec gates** — the repo already enforces spec-level gates; evals are the same idea at the model layer. Reuses the reader's existing trust.

## Out of scope

Tool comparison, benchmark survey, real datasets, listing-page or layout changes, cross-post linking infrastructure.
