# Design

## Approach

Two-edit fix in one workflow file plus a zero-dep smoke that parses the YAML
(by regex on raw contents) and asserts both edits are still present, so a
future refactor can't silently regress. The smoke is the gate.

## Files touched

- `.github/workflows/preview.yml` — add `env:` block to the `Preview deploy`
  step with both Cloudflare secrets; add `--env=""` to the wrangler command.
- `scripts/smoke-preview-workflow.ts` — new zero-dep regex-based smoke
  asserting the env block + `--env=` flag are present on the `Preview deploy`
  step. Exits 0 on green (prints `PREVIEW_WORKFLOW_OK`), non-zero with a
  line-numbered diagnostic on first failed assertion.

## Decisions

- **Regex on raw file contents (not YAML parse).** Two assertions, both
  string-shaped. Bun's experimental YAML would lock the smoke to a Bun version;
  pulling `js-yaml` for two regex assertions is overkill. Failure messages
  include the line number from `String.split("\n").findIndex(...)`.
- **Both Cloudflare secrets in the `env:` block (CLOUDFLARE_API_TOKEN AND
  CLOUDFLARE_ACCOUNT_ID).** Same input-drop failure mode applies to either
  secret; `accountId` happens to be reaching the action today but the same bug
  could hit it tomorrow. Wrangler reads both env vars natively. Marginal cost:
  one YAML line. Smoke asserts both with the same regex pattern.
- **`--env=""` (not `--env=preview`).** `wrangler.toml`'s `[env.preview]` block
  only contains `routes = []`; the deployable bits (`name`, `main`, `assets`,
  `compatibility_date`, `compatibility_flags`) live ONLY in the top-level.
  `--env=preview` would fail with "missing `name`". `--env=""` explicitly
  targets the top-level config and silences the multi-env warning.

## Risks

- **Repo-level secret may still be empty.** This spec fixes the workflow
  plumbing but cannot set `CLOUDFLARE_API_TOKEN` at the repo level — that
  requires manual action by the user. If the secret is empty, the preview job
  will still fail at runtime (with a clearer error from wrangler itself rather
  than from the action wrapper). Mitigation: report this in Step 10.

## Out of scope

- Re-setting the GitHub repo secret (`CLOUDFLARE_API_TOKEN`) manually — user
  action required, not a code change.
- `deploy.yml` (production deploy) — different secret pipeline, not part of the
  observed failure mode.
- `wrangler.toml` refactor (e.g. moving `name`/`main`/`assets` under
  `[env.preview]`) — not needed; `--env=""` handles the existing structure.
