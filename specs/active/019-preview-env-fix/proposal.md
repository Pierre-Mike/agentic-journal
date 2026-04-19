---
id: 019-preview-env-fix
title: Preview workflow env-var defense for wrangler secrets
status: active
kind: workflow
gate: scripts/smoke-preview-workflow.ts
created: 2026-04-19T00:00:00.000Z
owner: main
depends_on: [006-e2e-playwright]
supersedes: null
---

## Intent

Every PR must produce a working preview URL on first try, so reviewers can see
the actual rendered change before merge — restoring the feedback loop the
preview workflow is supposed to provide and that has been silently broken for at
least 5 PRs (PRs 15–19). All five failed at the `cloudflare/wrangler-action@v3`
step with `it is necessary to set CLOUDFLARE_API_TOKEN environment variable for
wrangler to work`. The action's input echo on those runs showed `accountId: ***`
but no `apiToken:` line at all — the action's input pipeline silently dropped
the secret, leaving wrangler with no env var to read. Fix: set both Cloudflare
secrets via the step's native `env:` block (which wrangler reads directly,
bypassing the action input layer) and pass `--env=""` to silence the multi-env
warning. Lock the fix with a zero-dep smoke that asserts both edits remain.

## Constraints

- TypeScript strict mode; no `any`; no `as` outside tests.
- Smoke is zero-new-deps — pure `node:fs` + regex on raw file contents (no
  `js-yaml`, no `Bun.YAML`).
- `.github/workflows/preview.yml` modified only at the `Preview deploy` step;
  other steps (checkout, setup-bun, install, build, comment) untouched.
- Other workflows (`deploy.yml`, `check.yml`, `e2e.yml`, …) untouched.
- No changes to `wrangler.toml`.
- The `apiToken` and `accountId` inputs in `with:` are preserved (belt and
  suspenders).

## Acceptance criteria

- [ ] `.github/workflows/preview.yml` Preview deploy step has an `env:` block
      with `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}` and
      `CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`.
- [ ] The wrangler command in `with.command` includes `--env=""`.
- [ ] The `apiToken` and `accountId` inputs in `with:` are preserved (belt and
      suspenders).
- [ ] `scripts/smoke-preview-workflow.ts` exists and exits 0 against the
      patched workflow.
- [ ] `scripts/smoke-preview-workflow.ts` exits non-zero with a diagnostic when
      the env block or `--env=` flag is missing (verified by temporarily
      breaking and reverting).
- [ ] `bun run check` passes.
- [ ] `bun run spec:lint` passes.
- [ ] `bun run tasks:verify` reports green for 019-preview-env-fix.

## Context

- Depends on 006-e2e-playwright (the most recent CI workflow spec).
- Discovered live during the 2026-04-19 session after the user asked why preview
  wasn't working; root-cause confirmed via `gh run view --log-failed` on PR #18,
  which showed the missing `apiToken:` line in the action's input echo.
- `wrangler.toml` has `[env.production]` and `[env.preview]` plus a top-level
  config. `--env=""` explicitly targets the top-level (matches the existing
  intent of the `versions upload --preview-alias` flow). `[env.preview]` only
  contains an empty `routes = []`; the deployable bits (`name`, `main`,
  `assets`, `compatibility_date`, `compatibility_flags`) live ONLY in the
  top-level — using `--env preview` would fail because that block lacks
  `name`/`main`/`assets`.
