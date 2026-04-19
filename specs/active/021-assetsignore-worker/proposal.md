---
id: 021-assetsignore-worker
title: Exclude worker bundle from public asset upload via .assetsignore
status: active
kind: code
gate: scripts/smoke-assetsignore.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on: []
supersedes: null
---

## Intent

Specs 019 (preview-env-fix) and 020 (deploy-env-fix) restored wrangler authentication so the production deploy reaches the asset-upload step. The deploy then failed with: `ERROR: Uploading a Pages _worker.js directory as an asset. This could expose your private server-side code to the public Internet.` This spec excludes the Astro-Cloudflare worker bundle from public asset upload using gitignore-style patterns in `public/.assetsignore`. Astro copies the file verbatim into `dist/` and wrangler honors it, so `dist/_worker.js/` stays out of the publicly-fetchable asset set while the worker still runs server-side.

## Constraints

- TypeScript strict, no `any`, no `as` outside tests.
- Smoke is zero new deps; pure file read; no build invocation; no network.
- No build script change — pure static-asset pass-through via Astro's `public/` directory contract.
- `public/.assetsignore` content is exactly `_worker.js\n_worker.js/**\n` (two lines + trailing newline).
- No other files modified.

## Acceptance criteria

- [ ] `public/.assetsignore` exists.
- [ ] `public/.assetsignore` content is exactly: `_worker.js\n_worker.js/**\n` (two lines, trailing newline).
- [ ] `scripts/smoke-assetsignore.ts` exists and exits 0 against the patched repo.
- [ ] Smoke exits non-zero with a diagnostic when the file is missing or content is wrong (verified by temporary break + revert).
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for 021-assetsignore-worker.

## Context

Conceptually pairs with the in-flight 020-deploy-env-fix (env-var restoration). 020 is required for wrangler auth to succeed; this spec is required for the asset-upload step that follows. `depends_on` left empty because the gate (file existence + content match) is independent of 020's gate — the smoke can prove green without 020 landing first, and the parent spec graph would otherwise reject 021. The deploy-pipeline ordering remains: 020 must merge before any production deploy succeeds. After both land and the next `deploy.yml` run completes, the live URL will be `https://agentic-journal.<your-cf-subdomain>.workers.dev`.
