---
id: 001-reading-time-on-posts
title: Reading-time utility shown on each post
status: active
kind: code
gate: src/lib/reading-time.test.ts
created: 2026-04-15
owner: main
depends_on: []
supersedes: null
---

## Intent

Every post page must show an estimated reading time so readers can gauge length-commitment before diving in. Compute it at build time from the raw MDX body via a pure utility and render it inline with the existing post meta.

## Constraints

- Pure, sync, no I/O utility — no Astro, Cloudflare, or filesystem deps
- Strips MDX/markdown noise before counting: fenced + inline code, MDX `import`/`export` lines, JSX tags, markdown links (keep label, drop URL), images, raw HTML tags
- Word split on `/\s+/`, empty entries filtered
- Exposes `WPM` constant (`200`) as a named export
- `minutes = Math.max(1, Math.round(words / WPM))`
- Colocated test at `src/lib/reading-time.test.ts` per constitution §8
- Route `src/pages/posts/[...slug].astro` appends `· N min read` to the existing meta line
- TypeScript strict; no `any`; no `as` outside test files

### Non-goals

- Frontmatter override (`reading_time:` in MDX) — YAGNI
- Per-language WPM tuning for code blocks
- Listing-page integration (this spec covers post page only)
- i18n / pluralization of the rendered string

## Acceptance criteria

- [ ] `src/lib/reading-time.ts` exports `readingTime(text: string): { minutes: number; words: number }`
- [ ] `src/lib/reading-time.ts` exports `WPM = 200`
- [ ] `src/lib/reading-time.test.ts` covers: WPM constant, prose count, rounding, minimum of 1, fenced-code strip, inline-code strip, MDX import/export strip, JSX tag strip, markdown link→label, image strip, HTML tag strip, determinism
- [ ] `bun test src/lib/reading-time.test.ts` exits 0
- [ ] `src/pages/posts/[...slug].astro` calls `readingTime(post.body)` and renders `· {minutes} min read` appended to the existing `{date} · spec {spec_id}` meta line

## Context

First user-visible reader-affordance on the blog. Anchors a pattern for later build-time-computed post metadata (estimated complexity, topic tags, etc.).
