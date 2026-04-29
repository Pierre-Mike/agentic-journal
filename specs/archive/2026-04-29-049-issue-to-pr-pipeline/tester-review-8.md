# Tester review — 049 slice 8 (attempt 1)

**Verdict**: PASS

## Rubric

### Item 0: RED proven
red-proof-8.txt not present at expected path, but dispatcher reports 8 failing assertions against the existing partial preview.yml (13 pass / 8 fail). Non-zero exit implied → RED confirmed. Failing assertions cover the load-bearing contract gaps: `deployments: write`, step-output capture + later reference, playwright `--base-url`/`PLAYWRIGHT_BASE_URL` env, playwright URL threading, automation-pipeline.test.ts step, `bun test` invocation, `continue-on-error: true`. These are the eight semantic deltas slice 8 must close.

### Item 1: Acceptance criterion coverage
YES
Mapping (AC: "preview.yml deploys via wrangler versions upload, posts preview URL on PR, runs playwright --base-url=$PREVIEW_URL, runs BDD outer gate"):
  - wrangler versions upload → "wrangler deploy" describe block ✓
  - CLOUDFLARE_API_TOKEN → "wrangler deploy" 4.2 ✓
  - preview URL captured → "preview URL step output" 5.1 / 5.2 ✓
  - PR comment with URL → "PR comment with preview URL" 6.1 / 6.2 ✓
  - playwright --base-url=$PREVIEW_URL → "playwright e2e" 7.1 / 7.2 / 7.3 ✓
  - BDD outer gate (RED-expected) → "outer BDD gate run" 8.1 / 8.2 / 8.3 (`continue-on-error: true`) ✓
  - Trigger/permissions scaffolding (PR events, deployments:write) → describes 2 + 3 ✓

### Item 2: Adversarial gap
YES (named, acceptable)
Concrete gap: tests are regex substring matches against the YAML source rather than parsed-AST checks. An implementer could:
  1. Place `continue-on-error: true` on any step (e.g. the wrangler deploy itself), not on the outer-gate step — test 8.3 would still pass.
  2. Put `PREVIEW_URL` in an unrelated env block far from the playwright step — test 7.3 (`/PREVIEW_URL|.../` anywhere in file) still passes.
  3. Reference `--base-url=https://hardcoded.example.com` in a comment line — test 7.2 still passes.
  4. Use `cloudflare/wrangler-action` in production-deploy mode (not preview/versions-upload) — test 4.1's alternation accepts the action regardless of mode.
These are characteristic trade-offs of YAML-shape gates where the alternative (parse YAML, walk the job/step graph, assert structural relationships) would be costly and brittle against valid implementation variants. The gaps are real but cosmetic at the slice-gate level; the outer BDD gate (slice 10) is the structural backstop.

### Item 3: Coverage gap
NO (minor only)
All AC-derived testable properties covered. Minor uncovered properties (not blocking):
  - Outer-gate step is not asserted to be inside a job that actually runs (could be `if: false` guarded). Slice 10 outer BDD will catch this end-to-end.
  - "Every push" wording in alignment is satisfied by `pull_request: synchronize` for feature branches; no separate `push:` trigger asserted, which matches the proposal's intent (preview is PR-scoped).

### Item 4: Behavior vs implementation detail
YES — tests behavior-pinned at the workflow-shape level
Regex patterns use alternations (`wrangler.*versions.*upload|cloudflare/wrangler-action`, `--base-url|PLAYWRIGHT_BASE_URL|BASE_URL`, `gh pr comment|github-script|create_comment|issue\.comment`) that admit multiple valid implementation strategies. No hardcoded action versions, no specific step-id names, no exact YAML key-order. Acceptable for a workflow-config gate.

## Verdict summary
PASS. The eight failing assertions correspond directly to the eight semantic gaps in the existing partial preview.yml that slice 8 must close. Coverage maps cleanly to the AC. Adversarial gaps named are typical of regex-based YAML-shape gates and are mitigated by the structural outer BDD gate landing in slice 10. Tests are behavior-pinned with sufficient alternation to allow valid implementation variants. Slice 8 may proceed to implementation.
