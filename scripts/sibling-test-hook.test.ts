/**
 * Unit tests for scripts/sibling-test-hook.ts (spec-032 RED gate).
 *
 * The module under test does NOT exist yet — every import-time reference
 * will fail, making these tests fail to run. That is the correct RED state.
 *
 * Fixtures are pure in-memory: a list of staged file paths plus an optional
 * map of path → first line content (for @no-test annotation checks). No real
 * git operations, no temp dirs.
 */

import { describe, expect, test } from "bun:test";

// @ts-expect-error — sibling-test-hook.ts does not exist yet; RED state intentional
import { checkSiblingTests } from "./sibling-test-hook.ts";

/**
 * Thin wrapper that matches the expected public API:
 *   checkSiblingTests(opts: {
 *     staged: string[];                     // output of git diff --cached --name-only
 *     readFirstLine?: (path: string) => string | undefined;  // content lookup
 *   }): { offenders: { file: string; expectedSibling: string }[]; pass: boolean }
 */
function run(
	staged: string[],
	firstLines: Record<string, string> = {},
): { offenders: { file: string; expectedSibling: string }[]; pass: boolean } {
	return (
		checkSiblingTests as (opts: {
			staged: string[];
			readFirstLine?: (path: string) => string | undefined;
		}) => { offenders: { file: string; expectedSibling: string }[]; pass: boolean }
	)({
		staged,
		readFirstLine: (p: string) => firstLines[p],
	});
}

describe("sibling-test-hook: src/ scope", () => {
	test("src/foo.ts staged with src/foo.test.ts → pass", () => {
		const result = run(["src/foo.ts", "src/foo.test.ts"]);
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});

	test("src/foo.ts staged without src/foo.test.ts → fail, lists offender", () => {
		const result = run(["src/foo.ts"]);
		expect(result.pass).toBe(false);
		expect(result.offenders).toContainEqual({
			file: "src/foo.ts",
			expectedSibling: "src/foo.test.ts",
		});
	});

	test("multiple src/ files missing siblings → all listed", () => {
		const result = run(["src/plex/client.ts", "src/plex/auth.ts"]);
		expect(result.pass).toBe(false);
		expect(result.offenders).toHaveLength(2);
		expect(result.offenders.map((o) => o.file)).toContain("src/plex/client.ts");
		expect(result.offenders.map((o) => o.file)).toContain("src/plex/auth.ts");
	});
});

describe("sibling-test-hook: scripts/ scope", () => {
	test("scripts/foo.ts staged with scripts/foo.test.ts → pass", () => {
		const result = run(["scripts/foo.ts", "scripts/foo.test.ts"]);
		expect(result.pass).toBe(true);
	});

	test("scripts/foo.ts staged without scripts/foo.test.ts → fail", () => {
		const result = run(["scripts/foo.ts"]);
		expect(result.pass).toBe(false);
		expect(result.offenders).toContainEqual({
			file: "scripts/foo.ts",
			expectedSibling: "scripts/foo.test.ts",
		});
	});
});

describe("sibling-test-hook: skipped file patterns", () => {
	test("*.test.ts files are skipped (not required to have their own sibling)", () => {
		const result = run(["src/foo.test.ts"]);
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});

	test("scripts/smoke-*.ts files are skipped", () => {
		const result = run(["scripts/smoke-deploy.ts"]);
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});

	test("scripts/gates/*.ts files are skipped", () => {
		const result = run(["scripts/gates/rule.ts"]);
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});

	test("files outside src/, scripts/, .claude/ are skipped", () => {
		// e.g. astro.config.ts at root
		const result = run(["astro.config.ts"]);
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});
});

describe("sibling-test-hook: @no-test annotation", () => {
	test("src/foo.ts with '// @no-test: generated file' on line 1 → pass", () => {
		const result = run(["src/foo.ts"], {
			"src/foo.ts": "// @no-test: generated file",
		});
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});

	test("src/foo.ts with '// @no-test' (empty reason) on line 1 → fail", () => {
		const result = run(["src/foo.ts"], {
			"src/foo.ts": "// @no-test",
		});
		expect(result.pass).toBe(false);
		expect(result.offenders.map((o) => o.file)).toContain("src/foo.ts");
	});

	test("src/foo.ts with '// @no-test: ' (whitespace-only reason) on line 1 → fail", () => {
		const result = run(["src/foo.ts"], {
			"src/foo.ts": "// @no-test: ",
		});
		expect(result.pass).toBe(false);
		expect(result.offenders.map((o) => o.file)).toContain("src/foo.ts");
	});

	test("src/foo.ts with @no-test on line 2 (not line 1) → fail (must be first line)", () => {
		// readFirstLine only sees line 1; if it doesn't match, no exemption
		const result = run(["src/foo.ts"], {
			"src/foo.ts": "export const x = 1;", // line 1 is not @no-test
		});
		expect(result.pass).toBe(false);
		expect(result.offenders.map((o) => o.file)).toContain("src/foo.ts");
	});
});

describe("sibling-test-hook: .claude/ scope", () => {
	test(".claude/hooks.ts staged without .claude/hooks.test.ts → fail", () => {
		const result = run([".claude/hooks.ts"]);
		expect(result.pass).toBe(false);
		expect(result.offenders).toContainEqual({
			file: ".claude/hooks.ts",
			expectedSibling: ".claude/hooks.test.ts",
		});
	});

	test(".claude/hooks.ts staged with .claude/hooks.test.ts → pass", () => {
		const result = run([".claude/hooks.ts", ".claude/hooks.test.ts"]);
		expect(result.pass).toBe(true);
	});
});

describe("sibling-test-hook: mixed staged set", () => {
	test("only test files staged → pass (nothing to enforce)", () => {
		const result = run(["src/foo.test.ts", "scripts/bar.test.ts"]);
		expect(result.pass).toBe(true);
	});

	test("one src file + its test + one src file missing its test → partial fail", () => {
		const result = run(["src/ok.ts", "src/ok.test.ts", "src/bad.ts"]);
		expect(result.pass).toBe(false);
		expect(result.offenders).toHaveLength(1);
		expect(result.offenders[0]?.file).toBe("src/bad.ts");
	});

	test("empty staged list → pass", () => {
		const result = run([]);
		expect(result.pass).toBe(true);
		expect(result.offenders).toEqual([]);
	});
});
