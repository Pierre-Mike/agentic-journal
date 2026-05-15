---
created: 2026-05-15
status: confirmed
confidence: high
intent_hash: 7dd51a1cd916
---

## Goal

Publish a blog post at `content/posts/templated-engineering.mdx` arguing that the unit of engineering output has shifted from code to the template that produces code. The post names "templated engineering" as a practice — treating the spec, gate, and scaffold as primary artifacts, with code as a derived diff. It matters because the industry is converging on this model (GitHub Spec Kit, AWS Kiro, Tessl, Claude Code skills) and practitioners lack a clear vocabulary for what they are already doing.

## Big Picture

This is a `kind: writeup` spec. The gate is the MDX file existing with all four required sections present. No code changes, no script changes. The entire work is one file.

```
specs/active/121-templated-engineering/
  proposal.md  (gate: content/posts/templated-engineering.mdx)

content/posts/
  templated-engineering.mdx   ← the deliverable
  harness-self-improvement.mdx  ← voice/structure reference
  your-computer-is-enough.mdx   ← voice/structure reference
```

The scaffold produces `proposal.md`. The implementation worker writes the MDX. `tasks:verify` checks the gate path exists and the four H2 headings are present. Archive closes the spec.

## Straightforward Details

### Frontmatter (fully specified by intent)

```
title: "Templated engineering"
date: 2026-05-15
spec_id: 121-templated-engineering
summary: ~25-word sentence naming the shift from code-as-artifact to template-as-artifact
tags: [agentic-engineering, spec-driven-development, templates]
required_sections: [Intent, Why, What, How]
```

### Gate

```
gate: content/posts/templated-engineering.mdx
```

Gate passes when: file exists AND all four sections (Intent, Why, What, How) are present as H2 headings. No other condition.

### Structure and voice

- Four sections: Intent, Why, What, How — matching sibling posts exactly
- Target length: ~5K–6K characters (opinionated, concrete, no bullet-soup prose)
- No external link citations in body (sources inform framing, do not appear)
- No first-person "I" (matches sibling post convention from 007)
- Personal-voice opinion piece, not documentation

### Per-section substance (fully specified by intent)

```
Intent  — Name the shift. Mold-making, not prompt polish. Agent is capable;
           template makes output predictable. Code is downstream.

Why     — Without template, capable agents drift (scope creep,
           architecturally-wrong diffs, vague intent → vague code).
           With template, diff is bounded by human-authored structure.
           Industry convergence: GitHub Spec Kit, AWS Kiro, Tessl,
           Claude Code skills. Fowler three-level taxonomy:
           spec-first, spec-anchored, spec-as-source.

What    — Concrete: this repository as the example.
           Every post is a writeup spec. Every spec has gate:.
           /do runs the loop. Constitution is the meta-template.
           Skills (align, retro, do) are templates for templates.
           "The MDX file you are reading was templated before a
           single word was written."

How     — Caveats and discipline. Curse of instructions (too many
           directives → model follows none). Out-of-scope matters
           as much as in-scope. Templates without "why" → correct
           code, wrong architecture. Discipline: keep lean, version,
           let retro loop trim. Template is a contract the gate
           enforces. If the gate cannot fail, the template is decoration.
```

### Spec proposal fields

```
id: 121-templated-engineering
kind: writeup
owner: main
depends_on: []
supersedes: null
```

## Non-obvious Decisions

### Section order: Intent before Why

Sibling posts (007, 034) open with Intent stating the thesis directly, then Why for the argument. An alternative would be opening with Why (the problem) before naming the practice in Intent. Rejected: both sibling posts lead with the named claim, then justify. Matching the convention ensures readers recognize the pattern and the gate-checker finds the headings in the expected sequence.

### Fowler taxonomy inclusion without citation link

Intent specifies citing Fowler's three-level taxonomy (spec-first, spec-anchored, spec-as-source) in the Why section, but explicitly prohibits external links in the body. The taxonomy names appear as framing terms, not footnoted references — same treatment used for industry tool names (Kiro, Tessl, etc.) that appear as evidence without linking out. This is the only plausible reading; no alternative needed.

### "Curse of instructions" framing in How

Intent names this concept directly. It anchors the How section's caveat on template discipline. No competing interpretation exists; the phrase maps one-to-one to the over-specification failure mode the intent describes.
