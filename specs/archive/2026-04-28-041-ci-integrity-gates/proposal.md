---
id: 041-ci-integrity-gates
title: 'Close CI integrity gaps — run tests, gate deploy, pin bun, e2e against build'
status: archived
kind: workflow
gate: scripts/smoke-ci-gates.ts
created: 2026-04-28T00:00:00.000Z
owner: main
depends_on:
  - 020-deploy-env-fix
supersedes: null
archived: '2026-04-28'
---

## Intent

Four CI/deploy integrity gaps currently allow broken code to reach production: unit tests are never run in CI, the deploy workflow has no prerequisite check job, all workflows pin `bun-version: latest` (non-deterministic toolchain), and Playwright e2e runs against the dev server instead of the static build Cloudflare actually serves. This spec closes all four gaps in a single PR so every push to main exercises a deterministic, fully-gated pipeline.

## Constraints

- All four fixes must land together in one PR — they are coupled by "CI integrity" surface.
- Bun version pinned in workflow YAML directly (no `.bun-version` file).
- Deploy gating via in-workflow `needs: check` job, NOT a `workflow_run` cross-workflow trigger.
- Playwright must use `bun run build && bun run preview` (Astro static preview), not `wrangler dev`.
- No changes to application source code (`src/`).
- Out of scope: Dependabot auto-updates, browser matrix expansion, Astro file formatting.

## Acceptance criteria

- [ ] `scripts/smoke-ci-gates.ts` exists and exits 0 after all four fixes are applied.
- [ ] `.github/workflows/ci.yml` check job runs `bun run test` before the Build step.
- [ ] `.github/workflows/deploy.yml` defines a `check` job and `deploy` job has `needs: [check]`.
- [ ] All four workflow files (`ci.yml`, `deploy.yml`, `preview.yml`, `on-spec.yml`) use a pinned `bun-version` (not `latest`).
- [ ] `playwright.config.ts` `webServer.command` uses `bun run build` and `bun run preview`.

## Context

- Spec 020-deploy-env-fix (archived): established the smoke-script gate pattern for workflow changes.
- Bug finding 1: `ci.yml` check job has no `bun run test` step — unit test failures merge silently.
- Bug finding 2: `deploy.yml` has `needs: []` — production can deploy on a red push.
- Bug finding 3: All four workflows use `bun-version: latest` — non-deterministic toolchain.
- Bug finding 4: `playwright.config.ts` `webServer.command: bun run dev` — e2e never hits the static build.
