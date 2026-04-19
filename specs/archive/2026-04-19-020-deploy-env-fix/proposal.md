---
id: 020-deploy-env-fix
title: Deploy workflow env-var defense for wrangler secrets
status: archived
kind: workflow
gate: scripts/smoke-deploy-workflow.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on:
  - 006-e2e-playwright
supersedes: null
archived: '2026-04-19'
---

## Intent

Production deploys must actually publish the app, so the live URL exists for
the first time and every push to main thereafter ships the change reviewers
signed off on. 5 consecutive production deploys (Apr 18 → Apr 19) failed at
the `Deploy to Cloudflare` step with "necessary to set CLOUDFLARE_API_TOKEN
environment variable for wrangler to work"; the action input echo showed
`accountId: ***` but no `apiToken:` line at all. The app has never gone live.
The structural bug is identical to the one fixed for `preview.yml` in spec
019 (preview-env-fix, PR #20): wrangler in non-interactive mode reads the
token from the process environment, not from action `with:` inputs, so we
must promote both Cloudflare secrets to a step-level `env:` block.

## Constraints

- TypeScript strict, no `any`, no `as` outside tests
- Smoke is zero-new-deps (pure file read + regex)
- `.github/workflows/deploy.yml` modified only at the "Deploy to Cloudflare"
  step; other steps (checkout, setup-bun, install, typecheck, spec:lint,
  tasks:verify, build) untouched
- Other workflows (preview.yml, ci.yml, etc.) untouched
- No shared helper extracted between this smoke and `smoke-preview-workflow.ts`
  — YAGNI / rule of three
- `apiToken`/`accountId` inputs in `with:` preserved (belt and suspenders)
- The wrangler command stays `deploy --env production` (matches
  wrangler.toml `[env.production]` block; do not touch)

## Acceptance criteria

- [ ] `.github/workflows/deploy.yml` "Deploy to Cloudflare" step has an
      `env:` block with `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`
      and `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`
- [ ] The wrangler command in `with.command` remains `deploy --env production`
      (unchanged)
- [ ] The `apiToken` and `accountId` inputs in `with:` are preserved
      (belt and suspenders)
- [ ] `scripts/smoke-deploy-workflow.ts` exists and exits 0 against the
      patched workflow
- [ ] `scripts/smoke-deploy-workflow.ts` exits non-zero with a diagnostic
      when the env block is missing (verify by temporarily breaking and
      reverting)
- [ ] `bun run check` passes
- [ ] `bun run spec:lint` passes
- [ ] `bun run tasks:verify` reports green for 020-deploy-env-fix

## Context

Depends on 006-e2e-playwright (the most recent CI/workflow spec — establishes
the workflow-as-spec pattern this one follows). Mirrors spec 019
(preview-env-fix, PR #20) — same structural bug applied to deploy.yml.
Discovered in the same /retro session 2026-04-19; the user asked
"do I have a link to see my app online?" and the answer was "no, production
has never deployed." This spec is the production-side fix.
