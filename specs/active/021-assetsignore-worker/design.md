# Design

## Approach

Add `public/.assetsignore` containing two gitignore-style patterns. Astro's `public/` directory copies it verbatim to `dist/.assetsignore` at build time. Wrangler reads `dist/.assetsignore` during `wrangler deploy` and excludes matching paths from the public asset upload — `dist/_worker.js/index.js` stops being publicly fetchable while the worker continues to run server-side. A zero-dep smoke (`scripts/smoke-assetsignore.ts`) asserts the source file's existence and exact content.

## Files touched

- `public/.assetsignore` — new source file. Two lines: `_worker.js` and `_worker.js/**`. Astro pipeline copies to `dist/`.
- `scripts/smoke-assetsignore.test.ts` — new smoke + bun:test gate. Pure file read; asserts existence + exact content match; clear diagnostics on miss. Dual-mode: under `bun test` it registers a `describe`/`test` (so the kind:code gate `bun test <path>` exits 0 cleanly); under `bun run` it executes the imperative path and prints `ASSETSIGNORE_OK` / `FAIL …`.

## Decisions

- **Explicit ignore patterns, NOT empty file.** Wrangler's "add empty file to hide this error" guidance is suppression, not a fix — empty file silences the warning while still uploading `dist/_worker.js/index.js` as a publicly-fetchable asset, which IS the exact security failure the warning was about. `.assetsignore` is gitignore-style; the file MUST contain `_worker.js` AND `_worker.js/**` (two lines, both needed: dir entry + contents glob). Cost identical to empty (one source file); benefit is genuine exclusion.
- **Static smoke, not build-then-check.** Validating the source file directly is fast (single `readFileSync`) and zero-dep. The post-build `dist/.assetsignore` check would require running `bun run build` inside the smoke — too slow for the gate loop. CI's `bun run build` step exercises the copy implicitly.
- **`.test.ts` filename + dual-mode invocation.** `scripts/gates/test.ts` runs `bun test <gate-path>`; bun test treats the path as a filter and exits 1 unless the filename matches `.test.` / `.spec.`. Naming the file `smoke-assetsignore.test.ts` satisfies the gate runner. The same module also runs as a script (`bun run …`) by detecting the test runner via a `describe.skip` probe — this preserves the colloquial smoke contract (`ASSETSIGNORE_OK` on stdout, exit 1 on fail) without a second source file.

## Risks

- Astro could change its `public/` contract for dotfiles. Mitigation: smoke catches source-file regressions; CI build catches copy regressions.

## Out of scope

- Changing `wrangler.toml` assets binding.
- Modifying the Astro adapter.
- Runtime tests against the live deploy URL.
- Any further deploy fixes beyond the worker-as-asset error.
