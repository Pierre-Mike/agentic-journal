# Design

Opinion post, personal voice. Single MDX file. Four required sections match existing blog convention.

## Approach

Write `content/posts/templated-engineering.mdx` following the `Intent → Why → What → How` structure established by `harness-self-improvement.mdx` and `your-computer-is-enough.mdx`. The thesis is the next layer up from the harness post: if the harness is a self-correcting loop, the template is the artifact that loop improves.

Section outline:

- **Intent** — State the shift. The unit of engineering output is no longer code; it is the template that produces code. Mold-making, not prompt polish. The agent is capable; what makes its output predictable is the template that surrounds it.
- **Why** — Without a template, capable agents drift: scope creep, locally-correct but architecturally-misguided diffs, vague intent producing vague code. With a template, the diff is bounded by a structure the human authored once and re-uses forever. The industry has converged on this — GitHub Spec Kit, AWS Kiro, Tessl, Claude Code skills are all variations on Constitution → Specify → Plan → Tasks → Implement. Reference Fowler's three-level taxonomy (spec-first, spec-anchored, spec-as-source) as a vocabulary lens.
- **What** — This repository is the lived proof. Every blog post is a spec of kind `writeup`. Every spec has a frontmatter `gate:` that fails RED before the work and turns GREEN to ship. `/do` runs the loop end-to-end. The constitution is the meta-template. Skills (align, retro, do) are templates for templates. The MDX file you are reading was templated before a single word was written.
- **How** — The caveats and the discipline. The "curse of instructions" — too many directives, the model follows none. Out-of-scope matters as much as in-scope. Templates without a "why" produce correct code in the wrong architecture. Keep templates lean, version them, let the retro loop trim them. The template is not a document; it is a contract that the gate enforces. If the gate cannot fail, the template is decoration.

## Files touched

- `content/posts/templated-engineering.mdx` — new post (currently in RED state with frontmatter only); Step 6 writes the four sections.

## Decisions

1. **Thesis framing** — software-design argument, not a tool review. Industry tools (Spec Kit, Kiro, Tessl, Claude Code skills) appear as evidence of convergence, not as the subject. The subject is the shift itself.
2. **Use this repo as the concrete example** — same move as `your-computer-is-enough.mdx` uses the author's local stack. Naming the gate / `/do` / skills makes the abstraction land; the reader can verify the claim against the file they are reading.
3. **No external links** — matches sibling posts. Sources inform framing, not body.
4. **Title** — `Templated engineering`. Short, declarative, two words. Matches title cadence of `harness-self-improvement`, `your-computer-is-enough`, `tdd-importance`.

## Risks

- Voice drifting into industry survey — mitigated by anchoring every paragraph in this repo's concrete artifacts (spec, gate, /do, retro).
- Curse-of-instructions caveat undercutting the thesis — mitigated by framing it as the discipline that makes templates work, not as an argument against templating.

## Out of scope

- Tool comparisons (Spec Kit vs Kiro vs Tessl)
- Spec-driven-development tutorials
- Predictions about which tool wins
- Code samples
- External link citations
