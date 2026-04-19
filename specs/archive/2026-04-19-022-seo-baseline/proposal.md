---
id: 022-seo-baseline
title: 'SEO baseline — sitemap, head metadata, JSON-LD, RSS feed'
status: archived
kind: workflow
gate: scripts/smoke-seo.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 021-assetsignore-worker
supersedes: null
archived: '2026-04-19'
---

## Intent

Spec 021 made the production deploy real: the blog is live at
`https://agentic-journal-production.pm-lemeliner.workers.dev`. As of that
moment SEO becomes a real concern — every post must be discoverable, fully
indexable, and shareable from a fresh visit, so search engines, RSS readers,
and social previews pull correct metadata without the reader executing any
JavaScript. This spec adds the three artifact layers that make that true:
per-post head metadata (canonical, OpenGraph, Twitter card, JSON-LD Article)
factored through a single `<SEOHead>` component, an `@astrojs/sitemap`
integration emitting `dist/sitemap-index.xml`, and an `@astrojs/rss` endpoint
at `/rss.xml`. All three are powered by one config edit (`site` field in
`astro.config.ts`) and one shared module (`src/site-config.ts`) so frontmatter
changes never desync OG/canonical/JSON-LD/RSS.

## Constraints

- TypeScript strict; no `any`; no `as` outside tests
- `<SEOHead>` exposes named props (one named-arg interface, no positional args)
- `src/site-config.ts` is the single source for `SITE_NAME`,
  `SITE_DESCRIPTION`, `AUTHOR_NAME` — duplicating these in `SEOHead` or
  `rss.xml.ts` is a defect
- Smoke runs `bun run build` (5–15s — slow but deterministic) and asserts
  against the real `dist/posts/<slug>/index.html`; source-only assertions miss
  build-coupling failures (e.g. `Astro.site` not propagating, sitemap silent
  no-op, RSS frontmatter break). Smoke short-circuits via `dist/` mtime check
- Two new dependencies allowed: `@astrojs/sitemap` and `@astrojs/rss` — both
  official Astro packages
- JSON-LD payload escaped via `set:html={JSON.stringify(...)}`; never inlined
  as a template literal

### Non-goals

- Per-post / generated OG images (Satori) — out of scope; without an image,
  social platforms still render text-based previews from `og:title` +
  `og:description`
- Default OG image — explicitly skipped (a bad default is worse than none)
- `hreflang`, multilingual variants
- Per-page schema beyond `Article` (no `BreadcrumbList`, no `WebSite` SearchAction)
- Layout redesign, routing changes, analytics

## Acceptance criteria

- [ ] `astro.config.ts` has `site: "https://agentic-journal-production.pm-lemeliner.workers.dev"`.
- [ ] `astro.config.ts` includes `sitemap()` integration from `@astrojs/sitemap`.
- [ ] `package.json` lists `@astrojs/sitemap` and `@astrojs/rss` as dependencies (or devDependencies).
- [ ] `src/site-config.ts` exports `SITE_NAME`, `SITE_DESCRIPTION`, `AUTHOR_NAME` as string constants.
- [ ] `src/components/SEOHead.astro` exists with the documented props interface.
- [ ] The post layout (`src/pages/posts/[...slug].astro`) imports and renders SEOHead with frontmatter-derived props.
- [ ] `src/pages/rss.xml.ts` exists and exports a `GET` handler returning an `@astrojs/rss` response.
- [ ] `scripts/smoke-seo.ts` exists and exits 0 against the patched repo.
- [ ] Smoke exits non-zero with a diagnostic when any expected tag/file is missing (verified by temporarily breaking SEOHead and reverting).
- [ ] After `bun run build`: `dist/sitemap-index.xml` exists, `dist/rss.xml` exists, every `dist/posts/*/index.html` contains canonical + og:title + og:description + twitter:card + JSON-LD Article.
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for 022-seo-baseline.

## Context

Depends on `021-assetsignore-worker` — the deploy that just started working.
First spec to expand the rendered HTML beyond `BaseLayout`'s existing chrome.
Production URL is the canonical site root for `Astro.site`, sitemap, and RSS.
