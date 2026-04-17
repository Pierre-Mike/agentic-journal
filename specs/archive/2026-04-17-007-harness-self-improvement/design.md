# Design — 007-harness-self-improvement

## Approach

One MDX post under `content/posts/` governed by a `kind=writeup` spec. Same gate shape already proven on 000 (day-0-why-this-blog) and 002 (evals-importance): the writeup gate scans the MDX for required section headings and fails until all four are present.

Argument arc:

- Hook: harnesses rot; friction accretes; skills go stale.
- Thesis: the triad — logs → feedback → retros — is the only cure.
- Evidence: the retro-of-retro anecdote. /retro found untread traces, /do shipped spec 005-trace-scan, the next /retro sees more.
- Close: same mechanism as the blog's spec-gate discipline, one layer up.

## Files touched

- `content/posts/harness-self-improvement.mdx` (new)

## Decisions

- Anchor "How" in a single anecdote, not a triad-to-artifact enumeration. Stories stick; enumerations read like docs.
- Target 700–900 words. Matches density of 000 and 002.
- Voice: third-person-ish ("this blog"), imperative, no first-person "I", short paragraphs.
- Cite specs 004 and 005 by id where the argument needs concrete evidence.
- One scannable one-line coda (logs = what happened; feedback = what hurt; retros = what to do) as the close of "What".

## Out of scope

- Tooling comparisons (no LangGraph-vs-LangChain)
- Documentation-style exhaustive enumeration
- Listing page / layout / build-script changes
