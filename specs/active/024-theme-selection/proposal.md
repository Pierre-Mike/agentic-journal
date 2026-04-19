---
id: 024-theme-selection
title: Dark/light theme selection
status: active
kind: workflow
gate: scripts/smoke-e2e.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 006-e2e-playwright
supersedes: null
---

## Intent

Readers get a user-chosen dark or light palette rendered on first paint with
no flash of unstyled content (FOUC). `output: "static"` means SSR cookie
negotiation is unavailable; use the canonical inline-head-script pattern to
resolve theme from `localStorage` + `prefers-color-scheme` before body paint.
A header toggle mutates `data-theme` on `<html>` and persists the choice to
`localStorage`, and every page receives it via `BaseLayout`.

The doneness proof is the Playwright scenario at `e2e/theme.e2e.ts` — it
asserts DOM state at `domcontentloaded` so FOUC is caught structurally
rather than by pixel diffing. The gate dispatcher is the existing
`scripts/smoke-e2e.ts` (from spec 006) which runs the full Playwright suite;
this spec is `kind: workflow` for the same reason spec 006 is — the gate
shape is "exit code from a CLI runner" not `bun test`.

## Constraints

- `output: "static"` stays; no SSR path
- TypeScript strict; no `any`, no `as` outside tests
- No new runtime dependencies
- Inline head script is synchronous, minimal, no modules, no async — ships as
  `<script is:inline>` so Astro does not hoist/bundle it
- Toggle works without a JS framework (plain `<script>` in the Astro component)
- Theme surface (toggle + palette) is visible on every page via `BaseLayout`
- Unicode glyphs only ("☀" / "☾"); no emoji (house rule)

### Non-goals

- `/settings` route or dedicated preferences page
- Three-state (system) toggle — users get "follow OS" automatically when
  `localStorage.theme` is unset
- Colour palette redesign beyond adding the dark overrides
- Per-post theme override
- `prefers-reduced-motion` handling (no animation on toggle anyway)

## Acceptance criteria

- [ ] `src/lib/theme.ts` exports `resolveTheme(stored, prefersDark)` and
      `nextTheme(current)` as pure functions, return types narrowed to
      `"light" | "dark"` string literals
- [ ] `src/lib/theme.test.ts` covers the resolution matrix (stored × OS ×
      none, both palettes) and `nextTheme` flip
- [ ] `src/layouts/BaseLayout.astro` ships `data-theme="light"` on `<html>`,
      defines a `[data-theme="dark"]` CSS variable block overriding `--fg`,
      `--bg`, `--muted`, `--accent`, and runs an inline synchronous head
      script that resolves the real theme from `localStorage` +
      `prefers-color-scheme` before body paint
- [ ] `src/components/ThemeToggle.astro` renders a button with
      `aria-label="Toggle color theme"`, Unicode glyph "☀"/"☾", and a
      visually-hidden current-state span; click mutates
      `document.documentElement.dataset.theme` and writes `localStorage.theme`
- [ ] `e2e/theme.e2e.ts` passes three cases:
      (a) `addInitScript` sets `localStorage.theme = "dark"` → `dataset.theme`
      is `"dark"` and `body` background matches dark palette at
      `domcontentloaded`;
      (b) `emulateMedia({ colorScheme: "dark" })` with no storage → dark at
      `domcontentloaded`;
      (c) click toggle → reload → `dataset.theme` persists
- [ ] `bun run spec:lint` passes
- [ ] `bun run tasks:verify` reports green for 024-theme-selection

## Context

Depends on 006-e2e-playwright — this is the first spec to add a new
Playwright scenario to that suite. SEO baseline from 022 and reading-time
from 001 are unaffected. No emoji anywhere in the toggle; Unicode symbols
match the monospace typography and honour the house no-emoji rule.

Gate is `scripts/smoke-e2e.ts` (kind: workflow) following the precedent set
by spec 006: Playwright scenarios are the doneness proof, the smoke script
is the dispatcher. The aligned plan named `tests/e2e/theme.spec.ts` as the
gate path; the existing Playwright config uses `testDir: "./e2e"` and
`testMatch: "**/*.e2e.ts"`, so the test file lands at `e2e/theme.e2e.ts`
where the runner will actually pick it up.
