---
id: 000-day-0-why-this-blog
title: "Day 0 — Why this blog is structured as specs"
status: archived
kind: writeup
gate: content/posts/day-0-why-this-blog.mdx
created: 2026-04-14
archived: 2026-04-14
owner: blog-lead
depends_on: []
supersedes: null
---

## Intent

Ship the first post of agentic-journal. Establish, in the reader's mind, that the blog itself is governed by the principles it describes: every post is a spec, every spec has a gate, the repo dogfoods the workflow.

## Constraints

- Must demonstrate the spec → gate → archive lifecycle end to end
- Post must cite the spec by ID so the audit trail is visible

## Acceptance criteria

- [x] `content/posts/day-0-why-this-blog.mdx` exists
- [x] MDX frontmatter sets `spec_id: 000-day-0-why-this-blog`
- [x] Post contains the required `Intent` section (writeup gate)
- [x] CI passes (typecheck, lint, spec-lint, build)
