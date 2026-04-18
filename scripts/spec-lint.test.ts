/**
 * Colocated unit tests for the pure functions in scripts/spec-lint.ts.
 *
 * Covers:
 *  - validateBoundary({ task, changedFiles, repoRoot }) — glob-matches diff files
 *    against a task's declared boundary globs.
 *  - validateTaskSchema(task) — checks shape of parsed tasks.md entries,
 *    including the new `boundary: string[]` field.
 *
 * Also exposes a default async function so this file works as a kind:rule gate
 * artifact (invoked by scripts/gates/rule.ts) — the default runs `bun test` on
 * this file and returns {pass, message}.
 */

import { describe, expect, test } from "bun:test";
import { validateBoundary, validateTaskSchema } from "./spec-lint.ts";

/**
 * When this module is imported by the kind:rule gate (not under the test
 * runner), `describe` throws. Probe safely and skip test registration in
 * that case — the gate's default export reinvokes `bun test` on this file
 * as a subprocess, which IS under the test runner.
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
	registerTests();
}

function registerTests(): void {
	describe("validateBoundary", () => {
		const repoRoot = "/tmp/fixture";

		test("empty changedFiles → ok", () => {
			const result = validateBoundary({
				task: { boundary: ["scripts/*.ts"] },
				changedFiles: [],
				repoRoot,
			});
			expect(result.ok).toBe(true);
		});

		test("all changed files inside a single glob → ok", () => {
			const result = validateBoundary({
				task: { boundary: ["scripts/*.ts"] },
				changedFiles: ["scripts/foo.ts", "scripts/bar.ts"],
				repoRoot,
			});
			expect(result.ok).toBe(true);
		});

		test("one file outside the glob → fail, lists offender", () => {
			const result = validateBoundary({
				task: { boundary: ["scripts/*.ts"] },
				changedFiles: ["scripts/foo.ts", "src/mystery.ts"],
				repoRoot,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.offendingFiles).toEqual(["src/mystery.ts"]);
			}
		});

		test("multiple globs: union semantics", () => {
			const result = validateBoundary({
				task: {
					boundary: ["scripts/*.ts", "specs/_template/*.md"],
				},
				changedFiles: ["scripts/a.ts", "specs/_template/tasks.md"],
				repoRoot,
			});
			expect(result.ok).toBe(true);
		});

		test("nested glob with ** matches recursive paths", () => {
			const result = validateBoundary({
				task: { boundary: ["src/**/*.ts"] },
				changedFiles: ["src/lib/deep/nested/file.ts"],
				repoRoot,
			});
			expect(result.ok).toBe(true);
		});

		test("escape hatch ['*'] matches anything", () => {
			const result = validateBoundary({
				task: { boundary: ["*"] },
				changedFiles: ["any/weird/path.ts", "README.md", "wrangler.toml"],
				repoRoot,
			});
			expect(result.ok).toBe(true);
		});

		test("undefined boundary → ok (backward compat, warning is not an error)", () => {
			const result = validateBoundary({
				task: { boundary: undefined },
				changedFiles: ["anywhere.ts"],
				repoRoot,
			});
			expect(result.ok).toBe(true);
		});

		test("empty boundary array → fails if any files changed", () => {
			const result = validateBoundary({
				task: { boundary: [] },
				changedFiles: ["any.ts"],
				repoRoot,
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.offendingFiles).toEqual(["any.ts"]);
			}
		});
	});

	describe("validateTaskSchema", () => {
		test("task without boundary → warning, no error", () => {
			const result = validateTaskSchema({
				index: 1,
				title: "old task",
				file_targets: ["a.ts"],
			});
			expect(result.errors).toEqual([]);
			expect(result.warnings.length).toBe(1);
			expect(result.warnings[0]).toMatch(/boundary/i);
		});

		test("task with valid boundary array → no errors, no warnings", () => {
			const result = validateTaskSchema({
				index: 1,
				title: "new task",
				file_targets: ["scripts/a.ts"],
				boundary: ["scripts/*.ts"],
			});
			expect(result.errors).toEqual([]);
			expect(result.warnings).toEqual([]);
		});

		test("boundary not an array → error", () => {
			const result = validateTaskSchema({
				index: 1,
				title: "bad task",
				file_targets: [],
				boundary: "scripts/*.ts" as unknown as string[],
			});
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]).toMatch(/array of strings/i);
		});

		test("boundary with non-string elements → error", () => {
			const result = validateTaskSchema({
				index: 1,
				title: "bad task",
				file_targets: [],
				boundary: ["scripts/*.ts", 42 as unknown as string],
			});
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]).toMatch(/array of strings/i);
		});

		test("empty boundary array → warning (hint: did you mean ['*']?)", () => {
			const result = validateTaskSchema({
				index: 1,
				title: "empty task",
				file_targets: [],
				boundary: [],
			});
			expect(result.warnings.length).toBe(1);
			expect(result.warnings[0]).toMatch(/empty/i);
		});
	});
}

/**
 * Default export so this file doubles as a kind:rule gate artifact.
 * Invokes `bun test` on itself; pass when exit code is 0.
 */
export default async function runGate(): Promise<{ pass: boolean; message: string }> {
	const proc = Bun.spawn(["bun", "test", import.meta.path], {
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	return {
		pass: code === 0,
		message: code === 0 ? "spec-lint tests pass" : "spec-lint tests failed",
	};
}
