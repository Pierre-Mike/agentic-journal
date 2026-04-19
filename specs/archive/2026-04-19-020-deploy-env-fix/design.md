# Design

## Approach

Two-line surgical fix to the production deploy workflow:

1. Add a step-level `env:` block to the "Deploy to Cloudflare" step in
   `.github/workflows/deploy.yml` exposing both `CLOUDFLARE_API_TOKEN` and
   `CLOUDFLARE_ACCOUNT_ID` as process env vars (which is what wrangler
   actually reads in non-interactive mode).
2. Lock the fix with a zero-dep regex-based smoke at
   `scripts/smoke-deploy-workflow.ts` that re-asserts the env block exists
   on every `tasks:verify` run.

## Files touched

- `.github/workflows/deploy.yml` — add `env:` block above `with:` on the
  Deploy to Cloudflare step. Other steps untouched. Wrangler command
  remains `deploy --env production`.
- `scripts/smoke-deploy-workflow.ts` — new file. Reads the workflow YAML,
  isolates the named step block, asserts both env entries are present.
  Exits 0 with `DEPLOY_WORKFLOW_OK` or 1 with a line-numbered diagnostic.

## Decisions

- **Duplicate the smoke logic, do NOT factor a shared helper with
  `smoke-preview-workflow.ts`.** YAGNI / rule of three. Two ~30-line smokes
  are fine duplicated; a shared helper would force a contract before we
  know what variants matter. If a third workflow needs the same shape in
  a future /retro cycle, that is the moment to extract.
- **Keep `--env production` in `with.command`.** wrangler.toml has a
  `[env.production]` block that holds the deployable bits — dropping the
  flag would deploy the top-level config, which is the wrong target for
  prod. (This differs from preview.yml, which uses `--env=""` because the
  preview branch resolves against the top-level config.)
- **Preserve `apiToken`/`accountId` inputs in `with:`** even though the
  env block makes them redundant for wrangler's process-env lookup.
  Belt-and-suspenders; matches the spec 019 decision.
- **Regex YAML parsing, no js-yaml.** Same as spec 019 — zero new deps,
  smoke runs in milliseconds, the assertion shape is dead simple.

## Risks

- **Repo-level secret could still be empty.** The workflow patch only
  ensures wrangler can READ the secret if it exists; if `CLOUDFLARE_API_TOKEN`
  is unset at the GitHub repo level, the deploy will still fail with the
  same error. Mitigation: surfaced in the Step 10 report — if the post-merge
  deploy.yml run is red despite the patch, the user runs
  `gh secret set CLOUDFLARE_API_TOKEN`.
- **YAML indentation drift.** If a future edit reformats the step block
  with different indentation, the regex needle for `findStepBlock` (which
  matches `-\s*name:\s*Deploy to Cloudflare`) still finds it; the
  `.includes()` checks for the env entries are whitespace-agnostic on
  surrounding context. Low risk.

## Out of scope

- Manually re-setting the GitHub repo secret (`gh secret set ...`) — the
  user does this if the post-merge run still fails
- `preview.yml` — covered by spec 019 (PR #20)
- `wrangler.toml` refactor or any change to the `[env.production]` block
- Extracting a shared helper between the two workflow smokes
- Any change to other workflow steps or other workflows
