# Design

## Approach

Install `@playwright/test`. Author `playwright.config.ts` at repo root — its
built-in `webServer` option spawns `bun run dev`. Write three small scenario
files under `e2e/` that exercise the homepage, a post page, and a 404. Gate is
`scripts/smoke-e2e.ts`, a thin spawner of `bunx playwright test`. Add an `e2e`
job to CI that installs Chromium, runs `bun run e2e`, and uploads the HTML
report on failure.

## Files touched

- `package.json` — `@playwright/test` devDep; `"e2e": "playwright test"` script
- `playwright.config.ts` (new) — testDir `./e2e`, chromium project, webServer
- `e2e/homepage.e2e.ts` (new) — `/` renders title + post list
- `e2e/post-page.e2e.ts` (new) — first post link routes to `/posts/:slug`,
  article body + meta (min read, spec) present
- `e2e/not-found.e2e.ts` (new) — `/posts/does-not-exist` returns 404 (status
  or body text)
- `e2e/fixtures.ts` (new) — `getFirstPostLink(page)` and related helpers
- `scripts/smoke-e2e.ts` (new) — gate; spawns `bunx playwright test`
- `.github/workflows/ci.yml` — add `e2e` job parallel to existing `check`
- `.gitignore` — append `playwright-report/`, `test-results/`

## Decisions

- **Playwright-test, not Cucumber.** Single-dev repo; Gherkin step-def
  indirection is ceremony with no audience. User originally asked for Cucumber
  and explicitly accepted the recommendation.
- **`kind=workflow` with smoke wrapper, not `kind=code`.** Matches existing
  pattern (`smoke-harness-fixes.ts`, `smoke-trace-scan.ts`,
  `smoke-do-delegation.ts`). Zero changes to `scripts/gates/test.ts`.
- **Dev-server mode over build+preview.** Typecheck and `astro build` already
  cover build failures in parallel CI jobs. Dev server is ~10x faster; keeps
  the e2e job under 2 minutes on CI. Flip to build+preview is a one-line
  config change if a prod-only regression ever surfaces.

## Risks

- Playwright browser install on CI adds ~1 minute to the first run. Mitigated
  by `--with-deps chromium` scoped to the one browser we use.
- Dev server output can be noisy and racy. Mitigated by `reuseExistingServer:
  !process.env.CI` plus a 30s startup timeout.

## Out of scope

Cucumber/Gherkin, multi-browser matrix, visual regression, a11y audits,
performance budgets, CI sharding.
