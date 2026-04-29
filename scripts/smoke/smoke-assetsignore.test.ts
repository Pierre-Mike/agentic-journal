/**
 * Gate for spec 021-assetsignore-worker.
 *
 * Asserts the source file `public/.assetsignore` exists with exact expected
 * content (two lines + trailing newline: `_worker.js\n_worker.js/**\n`).
 * Astro's `public/` pipeline copies it verbatim to `dist/.assetsignore`,
 * which wrangler reads on `wrangler deploy` to exclude the worker bundle
 * from public asset upload.
 *
 * Pure file read; zero new deps; no build invocation; no network. Authored
 * as `bun:test` so the kind:code gate (`bun test <path>`) recognizes it.
 *
 * Also runs as a standalone script — `bun run scripts/smoke-assetsignore.ts`
 * prints `ASSETSIGNORE_OK` on green and exits 1 with a diagnostic on red.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const ASSETSIGNORE_PATH = "public/.assetsignore";
const EXPECTED_CONTENT = "_worker.js\n_worker.js/**\n";

interface CheckResult {
	readonly ok: boolean;
	readonly message: string;
}

export function checkAssetsignore(): CheckResult {
	if (!existsSync(ASSETSIGNORE_PATH)) {
		return { ok: false, message: `MISSING: ${ASSETSIGNORE_PATH}` };
	}
	const actual = readFileSync(ASSETSIGNORE_PATH, "utf8");
	if (actual !== EXPECTED_CONTENT) {
		return {
			ok: false,
			message: `WRONG CONTENT in ${ASSETSIGNORE_PATH}: expected ${JSON.stringify(EXPECTED_CONTENT)}, got ${JSON.stringify(actual)}`,
		};
	}
	return { ok: true, message: "ASSETSIGNORE_OK" };
}

/**
 * `describe` throws when imported outside the bun test runner. Use that as
 * the dispatch: under `bun test` we register the assertion; under
 * `bun run scripts/smoke-assetsignore.ts` we run the imperative path.
 */
function underTestRunner(): boolean {
	try {
		describe.skip("__probe__", () => {});
		return true;
	} catch {
		return false;
	}
}

if (underTestRunner()) {
	describe("public/.assetsignore", () => {
		test("exists with exact expected content", () => {
			const result = checkAssetsignore();
			expect(result.ok, result.message).toBe(true);
		});
	});
} else if (import.meta.main) {
	const result = checkAssetsignore();
	if (!result.ok) {
		console.error(`smoke-assetsignore: FAIL ${result.message}`);
		process.exit(1);
	}
	console.log(result.message);
	process.exit(0);
}
