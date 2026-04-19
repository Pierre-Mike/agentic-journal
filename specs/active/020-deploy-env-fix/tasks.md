# Tasks

- [ ] 1. Author `scripts/smoke-deploy-workflow.ts` with full assertion logic
      (zero-dep regex parse of `.github/workflows/deploy.yml`, asserts both
      `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` env entries on the
      "Deploy to Cloudflare" step). Exits 0 with `DEPLOY_WORKFLOW_OK` or 1
      with a line-numbered diagnostic. RED against the unpatched workflow.
  - agent: main
  - depends: []
  - file_targets: [scripts/smoke-deploy-workflow.ts]
  - boundary: [scripts/smoke-deploy-workflow.ts]
- [ ] 2. Patch `.github/workflows/deploy.yml`: add a step-level `env:`
      block to the "Deploy to Cloudflare" step exposing both Cloudflare
      secrets. `with:` inputs and `--env production` command unchanged.
      Brings the smoke from RED to GREEN.
  - agent: main
  - depends: [1]
  - file_targets: [.github/workflows/deploy.yml]
  - boundary: [.github/workflows/deploy.yml]
