# Design

## Approach

Three artifact layers powered by one config edit and one shared module:

1. **Head metadata** — a single `<SEOHead>` Astro component renders title,
   description, canonical, OpenGraph, Twitter card, and JSON-LD `Article` from
   one named-arg props interface. The post layout
   (`src/pages/posts/[...slug].astro`) imports it and passes
   frontmatter-derived props.
2. **Sitemap** — `@astrojs/sitemap` integration in `astro.config.ts` emits
   `dist/sitemap-index.xml` automatically. Default config; no per-route
   filters needed.
3. **RSS** — `src/pages/rss.xml.ts` exports a `GET` handler using
   `@astrojs/rss` that enumerates the `posts` collection and serializes to
   `dist/rss.xml`.

`astro.config.ts` gets the Workers production URL set as `site:` so
`Astro.site` is defined at render-time, sitemap entries point at the right
host, and RSS receives a defined `context.site`. `src/site-config.ts` exports
`SITE_NAME` / `SITE_DESCRIPTION` / `AUTHOR_NAME` consumed by both `SEOHead`
and the RSS endpoint, removing the drift surface.

The gate `scripts/smoke-seo.ts` runs `bun run build` (with mtime
short-circuit) and substring-asserts against `dist/posts/<slug>/index.html`,
`dist/sitemap-index.xml`, and `dist/rss.xml`. No DOM parser dep.

## Files touched

- `astro.config.ts` — add `site` field (Workers URL) + `sitemap()` integration
- `package.json` — add `@astrojs/sitemap` and `@astrojs/rss` deps
- `src/site-config.ts` — NEW; site-level constants
- `src/components/SEOHead.astro` — NEW; single source for all post head tags
- `src/pages/posts/[...slug].astro` — wire `<SEOHead>` in around `<BaseLayout>`
- `src/pages/rss.xml.ts` — NEW; `@astrojs/rss` endpoint enumerating posts
- `scripts/smoke-seo.ts` — NEW; the gate

## Decisions

- **Smoke runs full `bun run build` and asserts against `dist/`** — source-only
  assertions miss build-coupling failures (Astro.site not propagating, sitemap
  silent no-op, RSS frontmatter break). Build cost ~5–15s; smoke
  short-circuits via dist/ mtime newer than `src/`, `content/`,
  `astro.config.ts`, `package.json`. Mirrors `scripts/smoke-e2e.ts` shape
  (script-as-gate with `kind: workflow`).
- **No default OG image — skip entirely** — a bad default (gradient, repo
  logo) is worse than none. Per-post OG images via Satori are the right
  long-term answer but explicitly out of scope. Without `og:image`, social
  platforms still render text-based previews from `og:title` +
  `og:description`. Adding it later = one line in `SEOHead` + image asset.
- **Site-level constants in `src/site-config.ts`** — both `SEOHead` AND
  `rss.xml.ts` need site name + tagline + author name. Hardcoding in two
  places guarantees drift. Module is ~10 lines of `export const`. Future
  site-level fields (favicon URL, social handles, default keywords) land
  here.
- **`kind: workflow` (not `code`)** — `scripts/gates/test.ts` runs `bun test`
  on the gate path, which expects `describe`/`test` files. A smoke script
  exit-coded as a CLI matches `kind: workflow` (see specs 003, 004, 005, 006,
  009, 014, 019, 020). Same gate path, correct dispatcher.

## Risks

- **`bun run build` fragility on smoke run** — if a content file has a
  malformed frontmatter the smoke fails opaquely. Mitigation: smoke prints
  full build stdout/stderr; failure mode is identical to `bun run build`
  failing, which is already a CI gate.
- **`Astro.site` undefined breaks canonical** — if `site` isn't set in
  `astro.config.ts`, `new URL(...).href` throws at render time and the build
  itself fails. Mitigation: smoke build exercises this path on every run.

## Out of scope

- Layout redesign, routing changes, analytics
- Custom OG images (per-post or default)
- `hreflang`, multilingual variants
- Per-page schema beyond `Article` (no `BreadcrumbList`, no `WebSite`
  SearchAction)
- Robots.txt customization
