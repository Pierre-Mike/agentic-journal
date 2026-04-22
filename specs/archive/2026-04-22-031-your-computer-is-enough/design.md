# Design

Opinion post, personal voice. Single MDX file. Four required sections match existing blog convention.

## Approach

Write `content/posts/your-computer-is-enough.mdx` following the `Intent → Why → What → How` section structure established by `harness-self-improvement.mdx`. Each section serves the thesis that local-first AI has crossed the design-relevant threshold.

Section outline:
- **Intent** — State the claim: local AI crossed the "good enough" line; software design should stop treating the user's machine as a thin client.
- **Why** — Cloud-only reflex is a holdover from when local inference was a toy. That assumption is now a design bug.
- **What** — Concrete first-person stack as evidence: (1) LM Studio + MLX running GLM-4 in orchestrator role; (2) Voice Ink transcribing + GLM-4 reviewing the transcript. Thesis line: "good enough for ~99% of what I do."
- **How** — Apps are no longer just a UI shell over a remote API. CPU + GPU become first-class execution targets. One bounded paragraph on MoE-style specialization per task (small specialized experts, hardware-aware placement) as the mechanism for why this is durable — no model-name predictions, no dates. Latency, privacy, cost consequences.

## Files touched

- `content/posts/your-computer-is-enough.mdx` — new post, created by spec-implementer

## Decisions

1. **Thesis framing** — post is a software-design argument, not a product review. Tools appear in **What** as lived proof the threshold has been crossed, not as the subject. "It's not just a UI application, we can leverage the CPU and GPUs" is the thesis; the product observations are evidence.
2. **Scope of examples** — narrow, first-person only. Two concrete examples: LM Studio + MLX + GLM-4 as orchestrator; Voice Ink + GLM-4 as transcription reviewer. No survey, no comparisons, no "other tools in the space."
3. **MoE / forward-looking paragraph** — keep it, bounded to one short paragraph inside **How**. Job: connect "apps leverage local CPU+GPU" to a concrete mechanism (MoE routing per task, small specialized experts, hardware-aware placement). No model-name predictions, no dates. It's the anchor for "why this is durable," not the subject.
4. **Title** — `Your computer is enough`. Matches this blog's title cadence (short, declarative, no colon; see `harness-self-improvement.mdx`, `evals-importance.mdx`). Short sentence, load-bearing claim, reader-facing ("your" computer).

## Risks

- Voice wandering into product-review territory — mitigated by framing tools as evidence in What, not subject
- MoE paragraph growing beyond scope — mitigated by explicit one-paragraph constraint

## Out of scope

- Benchmarks or performance comparisons
- Tool surveys ("other tools in the space")
- Code samples
- Model-name predictions or release dates
- Any post content authored by the spec-tester (gate is absent in RED state)
