## Approach

**Fix 1 — unit tests in CI:** Add a `bun run test` step to the `check` job in `.github/workflows/ci.yml`, inserted before the existing `Build` step. The local `bun run check` script already runs `bun test`; this brings CI into parity. No additional dependencies needed.

**Fix 2 — gate deploy on check:** Add a minimal `check` job to `.github/workflows/deploy.yml` (install → typecheck → lint:ci → spec-lint → tasks-verify → test → build) and set `deploy: needs: [check]`. Using in-workflow `needs:` keeps the gating atomic per push and avoids the complexity of cross-workflow `workflow_run` triggers. The deploy job only runs if every check step exits 0.

**Fix 3 — pin bun-version:** Replace `bun-version: latest` with `bun-version: 1.2.4` in all four workflow files (`ci.yml`, `deploy.yml`, `preview.yml`, `on-spec.yml`). The version is hardcoded in YAML directly — no `.bun-version` file — so upgrades are a single PR sweep across all four files and the change is visible in diff. `1.2.4` is the current stable minor at time of authoring.

**Fix 4 — e2e against built artifact:** Replace `webServer.command: "bun run dev"` with `"bun run build && bun run preview"` in `playwright.config.ts`. Astro's `preview` command serves the static build output, matching what Cloudflare Pages actually serves. The `webServer.timeout` is bumped to accommodate the longer build step (e.g., 120_000 ms).

## Files touched

- `.github/workflows/ci.yml` — add `bun run test` step
- `.github/workflows/deploy.yml` — add `check` job, set `needs: [check]` on deploy
- `.github/workflows/preview.yml` — pin `bun-version`
- `.github/workflows/on-spec.yml` — pin `bun-version`
- `playwright.config.ts` — swap webServer command, bump timeout
- `scripts/smoke-ci-gates.ts` — new gate script (asserts all four fixes present)

## Decisions

- **Bundled, not split:** Four small YAML/config edits in the tightly-coupled "CI integrity" surface. One PR, one gate keeps review and rollback atomic.
- **Bun version hardcoded in YAML:** Keeps the upgrade story to a single PR sweep across all four files; `.bun-version` would add a fifth file with no additional clarity.
- **Deploy gating via `needs:`:** In-workflow job dependency is simpler to debug than `workflow_run` cross-workflow triggers and runs atomically on the same push SHA.
- **e2e command:** `bun run build && bun run preview` (Astro static preview) over `wrangler dev` keeps CI hermetic — no Cloudflare credentials needed, no network calls, exercises the actual build artifact.

## Out of scope

- Dependabot auto-updates for `bun-version` — flagged, deferred; requires a separate Dependabot config PR.
- Browser matrix expansion (Firefox, WebKit) — deferred; orthogonal to integrity fixes.
- Astro file formatting changes — not part of this integrity surface.
