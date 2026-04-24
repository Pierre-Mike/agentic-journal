/**
 * Colocated unit tests for the pure functions in scripts/spec-lint.ts.
 *
 * Covers:
 *  - validateBoundary({ task, changedFiles, repoRoot }) — glob-matches diff files
 *    against a task's declared boundary globs (parseBracketList strips quotes).
 *    against a task's declared boundary globs.
 *  - validateTaskSchema(task) — checks shape of parsed tasks.md entries,
 *    including the new `boundary: string[]` field.
 *
 * spec-032 RED additions:
 *  - gateEntries() from scripts/_lib.ts (does not exist yet — RED)
 *  - validateGateLevels() from scripts/spec-lint.ts (does not exist yet — RED)
 *
 * spec-033 RED additions (now GREEN):
 *  - detectDuplicateIds() from scripts/spec-lint.ts
 *
 * Also exposes a default async function so this file works as a kind:rule gate
 * artifact (invoked by scripts/gates/rule.ts) — the default runs `bun test` on
 * this file and returns {pass, message}.
 */

import { describe, expect, test } from "bun:test";
import { gateEntries } from "./_lib.ts";
import { validateBoundary, validateTaskSchema } from "./spec-lint.ts";

// spec-033: detectDuplicateIds does not exist yet — import will resolve at
// runtime via getDetectDuplicateIds() helper below (RED).

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

	// ----------------------------------------------------------------
	// spec-032 RED: gateEntries() — does not exist in _lib.ts yet
	// These tests MUST fail until _lib.ts exports gateEntries().
	// ----------------------------------------------------------------
	describe("gateEntries — scalar gate (legacy lift)", () => {
		test("scalar gate string → [{path, level:'unit'}]", () => {
			// gateEntries is imported with @ts-expect-error above
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const entries = (gateEntries as (s: unknown) => unknown[])({
				frontmatter: { gate: "scripts/foo.test.ts" },
			});
			expect(entries).toEqual([{ path: "scripts/foo.test.ts", level: "unit" }]);
		});
	});

	describe("gateEntries — list gate", () => {
		test("list gate with valid levels → passes through", () => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call
			const entries = (gateEntries as (s: unknown) => unknown[])({
				frontmatter: {
					gate: [
						{ path: "src/foo.test.ts", level: "unit" },
						{ path: "scripts/smoke-foo.ts", level: "e2e" },
					],
				},
			});
			expect(entries).toEqual([
				{ path: "src/foo.test.ts", level: "unit" },
				{ path: "scripts/smoke-foo.ts", level: "e2e" },
			]);
		});

		test("invalid level string → throws with message matching /unknown gate level/i", () => {
			expect(() =>
				(gateEntries as (s: unknown) => unknown[])({
					frontmatter: {
						gate: [{ path: "src/foo.test.ts", level: "bad-level" }],
					},
				}),
			).toThrow(/unknown gate level/i);
		});

		test("duplicate path across entries → throws with message matching /duplicate gate path/i", () => {
			expect(() =>
				(gateEntries as (s: unknown) => unknown[])({
					frontmatter: {
						gate: [
							{ path: "src/foo.test.ts", level: "unit" },
							{ path: "src/foo.test.ts", level: "integration" },
						],
					},
				}),
			).toThrow(/duplicate gate path/i);
		});
	});

	// ----------------------------------------------------------------
	// spec-032 RED: validateGateLevels() — does not exist in spec-lint.ts yet
	// These tests MUST fail until spec-lint.ts exports validateGateLevels().
	// ----------------------------------------------------------------
	describe("validateGateLevels — kind:code level coverage", () => {
		// Dynamic import so the @ts-expect-error is scoped.
		// At runtime the function won't exist → test will error (RED).
		function getValidateGateLevels(): (opts: {
			kind: string;
			entries: { path: string; level: string }[];
		}) => { errors: string[] } {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.validateGateLevels !== "function") {
				throw new Error(
					"validateGateLevels is not exported from spec-lint.ts (RED — not yet implemented)",
				);
			}
			return mod.validateGateLevels as (opts: {
				kind: string;
				entries: { path: string; level: string }[];
			}) => { errors: string[] };
		}

		test("kind:code with only unit entries → error naming both required tiers", () => {
			const validateGateLevels = getValidateGateLevels();
			const result = validateGateLevels({
				kind: "code",
				entries: [{ path: "src/foo.test.ts", level: "unit" }],
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toMatch(/integration|e2e/i);
		});

		test("kind:code with only integration entries → error naming unit required", () => {
			const validateGateLevels = getValidateGateLevels();
			const result = validateGateLevels({
				kind: "code",
				entries: [{ path: "scripts/smoke-foo.ts", level: "integration" }],
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toMatch(/unit/i);
		});

		test("kind:code with unit + e2e → no errors", () => {
			const validateGateLevels = getValidateGateLevels();
			const result = validateGateLevels({
				kind: "code",
				entries: [
					{ path: "src/foo.test.ts", level: "unit" },
					{ path: "scripts/smoke-foo.ts", level: "e2e" },
				],
			});
			expect(result.errors).toEqual([]);
		});

		test("kind:rule with only unit entries → no errors (not subject to level enforcement)", () => {
			const validateGateLevels = getValidateGateLevels();
			const result = validateGateLevels({
				kind: "rule",
				entries: [{ path: "scripts/spec-lint.test.ts", level: "unit" }],
			});
			expect(result.errors).toEqual([]);
		});
	});

	// ----------------------------------------------------------------
	// spec-033 RED: detectDuplicateIds() — does not exist in spec-lint.ts yet.
	// These tests MUST fail until spec-lint.ts exports detectDuplicateIds().
	// ----------------------------------------------------------------
	describe("detectDuplicateIds — rejects duplicate spec IDs across active and archive", () => {
		/**
		 * Retrieve detectDuplicateIds from spec-lint.ts at runtime so that the
		 * import error is scoped to this describe block (RED behaviour: the
		 * function does not exist yet).
		 *
		 * Expected signature:
		 *   detectDuplicateIds(slugs: string[]): { errors: string[] }
		 *
		 * `slugs` is the union of active folder basenames (e.g. "033-spec-lint-duplicate-ids")
		 * and archive folder basenames with the date prefix stripped
		 * (e.g. "2026-04-21-030-retro-dormant-worktrees" → "030-retro-dormant-worktrees").
		 * The function groups slugs by their leading \d+ and emits one error per
		 * colliding NNN in the format:
		 *   "duplicate spec id NNN: <slug-a>, <slug-b>"
		 */
		function getDetectDuplicateIds(): (slugs: string[]) => { errors: string[] } {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.detectDuplicateIds !== "function") {
				throw new Error(
					"detectDuplicateIds is not exported from spec-lint.ts (RED — not yet implemented)",
				);
			}
			return mod.detectDuplicateIds as (slugs: string[]) => { errors: string[] };
		}

		test("no duplicates → no errors", () => {
			const detectDuplicateIds = getDetectDuplicateIds();
			const result = detectDuplicateIds([
				"001-reading-time-on-posts",
				"002-evals-importance",
				"030-retro-dormant-worktrees",
			]);
			expect(result.errors).toEqual([]);
		});

		test("two active slugs share NNN → error names both slugs", () => {
			const detectDuplicateIds = getDetectDuplicateIds();
			const result = detectDuplicateIds([
				"030-retro-dormant-worktrees",
				"030-fold-judge-escalation",
			]);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toMatch(/duplicate spec id 030/i);
			expect(result.errors[0]).toContain("030-retro-dormant-worktrees");
			expect(result.errors[0]).toContain("030-fold-judge-escalation");
		});

		test("active slug and archive slug share NNN → error names both slugs", () => {
			const detectDuplicateIds = getDetectDuplicateIds();
			// Archive entries arrive with date prefix already stripped by caller
			const result = detectDuplicateIds([
				"030-retro-dormant-worktrees",
				"030-fold-judge-escalation",
				"030-skip-judge-rule-workflow",
			]);
			expect(result.errors.length).toBeGreaterThan(0);
			// All three slugs share 030; error must name them all
			const combined = result.errors.join("\n");
			expect(combined).toMatch(/030/);
			expect(combined).toContain("030-retro-dormant-worktrees");
			expect(combined).toContain("030-fold-judge-escalation");
			expect(combined).toContain("030-skip-judge-rule-workflow");
		});

		test("error format: 'duplicate spec id NNN: slug-a, slug-b'", () => {
			const detectDuplicateIds = getDetectDuplicateIds();
			const result = detectDuplicateIds(["007-alpha", "007-beta"]);
			expect(result.errors.length).toBe(1);
			expect(result.errors[0]).toMatch(/^duplicate spec id 007:/i);
		});

		test("multiple distinct NNN collisions → one error per NNN", () => {
			const detectDuplicateIds = getDetectDuplicateIds();
			const result = detectDuplicateIds([
				"005-workflow-canvas",
				"005-trace-scan",
				"030-retro-dormant-worktrees",
				"030-fold-judge-escalation",
			]);
			expect(result.errors.length).toBe(2);
			const combined = result.errors.join("\n");
			expect(combined).toMatch(/005/);
			expect(combined).toMatch(/030/);
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
