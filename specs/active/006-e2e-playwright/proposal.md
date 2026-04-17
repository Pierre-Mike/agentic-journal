---
id: 006-e2e-playwright
title: E2E tests via Playwright
status: active
kind: workflow
gate: scripts/smoke-e2e.ts
created: 2026-04-17
owner: main
depends_on: []
supersedes: null
---

## Intent

Add end-to-end coverage that exercises the built site — visit the real pages,
assert user-visible behaviour — so regressions in layout, routing, or content
rendering are caught automatically before a PR merges. Unit and smoke layers
existed but no layer drove the actual rendered HTML. This spec closes that gap
with Playwright-test spawning a dev server and driving Chromium headless.

## Constraints

- Playwright-test is the runner and the scenario layer (not Cucumber)
- `kind=workflow` — the gate is a smoke wrapper over `playwright test`; no
  changes to `scripts/gates/test.ts`
- Dev-server mode via Playwright's built-in `webServer` (not build+preview)
- Chromium only; headless
- No `any`, no `as` outside test fixtures
- E2E tests live in top-level `e2e/` (not under `src/`, not under `tests/`)
- CI gets a dedicated `e2e` job in `.github/workflows/ci.yml`

### Non-goals

- Cucumber / Gherkin step definitions
- Multi-browser matrix (Firefox, WebKit)
- Build+preview mode
- Visual regression snapshots
- Accessibility audits
- Performance budgets

## Acceptance criteria

- [ ] `playwright.config.ts` exists with `webServer` pointing at `bun run dev`
- [ ] `e2e/homepage.e2e.ts`, `e2e/post-page.e2e.ts`, `e2e/not-found.e2e.ts` exist
- [ ] `e2e/fixtures.ts` exists (even if minimal)
- [ ] `package.json` has an `e2e` script invoking `playwright test`
- [ ] `@playwright/test` is a devDependency
- [ ] `scripts/smoke-e2e.ts` spawns `bunx playwright test` and returns its exit code
- [ ] `.github/workflows/ci.yml` contains a job named `e2e`
- [ ] `bun run tasks:verify` exits 0 (smoke green)
- [ ] `bun run spec:lint` exits 0

## Context

BDD/TDD story in this repo was unit + smoke — no layer exercised the built
site. PR #6 (spec 005 trace-scan) adds runtime observability; this spec adds
runtime verification. User originally asked for Cucumber; accepted
Playwright-test recommendation because there is no Gherkin audience for a
single-dev repo and the step-def indirection is ceremony.
