# Design

## Approach

Static HTML ships with `data-theme="light"` on `<html>`. An inline
synchronous `<script is:inline>` in `<head>` reads `localStorage.theme` and
`window.matchMedia("(prefers-color-scheme: dark)").matches`, computes the
resolved theme via the same truth table as `resolveTheme` in
`src/lib/theme.ts`, and sets `document.documentElement.dataset.theme` before
body paint. CSS `[data-theme="dark"]` redeclares the four palette variables
(`--fg`, `--bg`, `--muted`, `--accent`) plus code/pre backgrounds, so the
cascade switches instantly without a FOUC window.

`<ThemeToggle>` is a header right-aligned button with Unicode glyph "☀"/"☾"
and a visually-hidden current-state `<span>`. Its client script imports
`nextTheme` from `src/lib/theme.ts` (bundled normally by Astro), flips
`document.documentElement.dataset.theme`, writes `localStorage.theme`, and
swaps the glyph + sr-only text.

The Playwright scenario `e2e/theme.e2e.ts` asserts DOM state at
`domcontentloaded` — not screenshot diffs, not transition listeners. Three
cases: stored preference, OS preference, persistence across reload.

## Files touched

- `src/lib/theme.ts` — NEW; `resolveTheme` + `nextTheme` pure functions
- `src/lib/theme.test.ts` — NEW; colocated bun:test unit for both functions
- `src/components/ThemeToggle.astro` — NEW; button + client script
- `src/layouts/BaseLayout.astro` — `[data-theme="dark"]` overrides, inline
  head script, `<ThemeToggle/>` rendered in header
- `e2e/theme.e2e.ts` — NEW; Playwright scenario (the doneness proof)

## Decisions

- **Default fallback is light** — matches ship default in CSS `:root`.
  Resolution order: `stored === "light" | "dark"` → use it; else `matchMedia
  dark matches` → `"dark"`; else → `"light"`.
- **Gate asserts DOM state at `domcontentloaded`** — not pixel sampling.
  `addInitScript` runs before any page script; reading
  `document.documentElement.dataset.theme` and computed `backgroundColor`
  catches FOUC structurally. Screenshot comparison is brittle; transition
  listeners fire on CSS-variable changes with zero delay anyway.
- **Toggle is two-state only** — users get "follow OS" automatically when
  `localStorage.theme` is unset. A third "system" button is optional
  complexity; pay that cost only if requested.
- **Unicode glyphs, not emoji** — "☀" and "☾" render correctly in monospace
  and honour the house no-emoji rule.
- **Inline head script duplicates `resolveTheme` logic** — acceptable and
  necessary. The script runs before modules load; it cannot import.
  `src/lib/theme.ts` is the unit-tested source of truth; the four-line
  inline duplicate is the performance-critical path. This is the canonical
  static-site theme-bootstrap pattern.
- **`kind: workflow`, gate `scripts/smoke-e2e.ts`** — spec 006 proved this
  dispatcher for Playwright tests. `kind: code` would route the gate
  through `bun test`, which cannot run `@playwright/test`. The doneness
  proof is `e2e/theme.e2e.ts`; the smoke is the mechanical wrapper.

## Risks

- **Astro bundling of the inline script** — must use `<script is:inline>`
  (not `<script>`). Without `is:inline`, Astro hoists and defers the script,
  re-introducing FOUC. The e2e test catches this.
- **code/pre backgrounds** — currently hard-coded `#eee`. Either promote to
  variables or add explicit dark overrides. Forgetting this yields unreadable
  code blocks in dark mode.

## Out of scope

- `/settings` route, three-state toggle, colour palette redesign
- Per-post theme override, `prefers-reduced-motion`
- OG image variants per theme
- CSS transitions between themes (instant swap)
