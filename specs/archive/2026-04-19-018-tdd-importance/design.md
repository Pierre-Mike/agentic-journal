# Design

## Approach

Author a single MDX post arguing that TDD becomes load-bearing in the LLM era.
The thesis is one claim made three times at three layers — unit test → spec
gate → eval — closed by reframing classical-TDD orthodoxy: their critique
presumed slow human authors with deep domain familiarity; both premises
evaporate with LLM authorship.

Writing order across four tasks: Intent + Why (one ASCII diagram) → What (one
ASCII triptych, cites spec 016) → How (four concrete moves) → final pass
(word count, link count, diagram count, orthodoxy paragraph, spec-016
reference).

## Files touched

- `content/posts/tdd-importance.mdx` — new post; gate artifact

## Decisions

- **Engage classical-TDD orthodoxy head-on, then reframe.** One paragraph in
  Why acknowledges the DHH "TDD is dead" / Coplien "Most Unit Testing Is Waste"
  critique, then reframes: their argument presumed slow human authors with deep
  domain familiarity. Both premises evaporate with LLM authorship. One
  paragraph max — this isn't 2014 and we're not relitigating the debate.
- **AI scope: BOTH layers, anchored on LLM-as-author as primary; AI-as-system
  as parallel.** Lead with LLM-as-author (the new acute pain). Use
  AI-as-system (evals) as the parallel — share the same shape (falsifiable
  claim before change). Link `evals-importance` instead of reproving its thesis.
- **One concrete repo reference (spec 016 RED-bypass), rest abstract.**
  Spec 016 is the perfect citation: real RED commit blocked by typecheck hook
  → deviation logged → /retro acted on it → next spec installed the bypass.
  That's TDD's red→green→refactor visible in git history. Cite ONCE in What
  or How. Do NOT add more spec IDs — turns post into a changelog.

## Out of scope

- Any code or script changes
- Modifying existing posts
- Adding tag-page templates or modifying the tags index
- Cross-post linking infrastructure beyond inline `[text](/posts/slug)` markdown
- External citations / hyperlinks (this blog cites itself)
- Code samples (discipline is the artifact)
