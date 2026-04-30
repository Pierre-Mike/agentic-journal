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
import { gateEntries } from "../_lib.ts";
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

	// ----------------------------------------------------------------
	// spec-049 slice 1 RED: depends_on and touches schema enforcement
	// 13 tests total (dispatch brief said 10; count was revised upward to cover:
	//   template structure ×4, schema negative cases ×5, valid cases ×2,
	//   boundary cross-check ×1, parser round-trip ×1)
	// These tests MUST fail until:
	//   - specs/_template/tasks.md declares depends_on: and touches: on every slice
	//   - validateTaskSchema() enforces touches: (non-empty path list)
	//   - validateTaskSchema() enforces depends_on: (list of integers)
	//   - validateTaskSchema() rejects touches: entries outside boundary: globs
	//   - parseTasksFile() parses depends_on: and touches: fields
	// ----------------------------------------------------------------
	describe("spec-049: template tasks.md declares depends_on and touches on every task", () => {
		function getParseTasksFileRaw(): (path: string) => readonly Record<string, unknown>[] {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.parseTasksFile !== "function") {
				throw new Error("parseTasksFile not exported from spec-lint.ts");
			}
			return mod.parseTasksFile as (path: string) => readonly Record<string, unknown>[];
		}

		const templateTasksPath = require("node:path").join(
			require("node:path").dirname(require.resolve("./spec-lint.ts")),
			"../../specs/_template/tasks.md",
		) as string;

		test("every task in _template/tasks.md declares depends_on:", () => {
			const parseTasksFile = getParseTasksFileRaw();
			const tasks = parseTasksFile(templateTasksPath);
			expect(tasks.length).toBeGreaterThan(0);
			for (const task of tasks) {
				expect(
					Object.hasOwn(task, "depends_on"),
					`task "${String(task.title ?? task.index)}" is missing depends_on:`,
				).toBe(true);
			}
		});

		test("every task in _template/tasks.md declares touches:", () => {
			const parseTasksFile = getParseTasksFileRaw();
			const tasks = parseTasksFile(templateTasksPath);
			expect(tasks.length).toBeGreaterThan(0);
			for (const task of tasks) {
				expect(
					Object.hasOwn(task, "touches"),
					`task "${String(task.title ?? task.index)}" is missing touches:`,
				).toBe(true);
			}
		});

		test("every task's touches: in _template/tasks.md is a non-empty array of strings", () => {
			const parseTasksFile = getParseTasksFileRaw();
			const tasks = parseTasksFile(templateTasksPath);
			expect(tasks.length).toBeGreaterThan(0);
			for (const task of tasks) {
				const touches = task.touches;
				expect(
					Array.isArray(touches) && (touches as unknown[]).length > 0,
					`task "${String(task.title ?? task.index)}" has empty or non-array touches:`,
				).toBe(true);
			}
		});

		test("every task's depends_on: in _template/tasks.md is an array", () => {
			const parseTasksFile = getParseTasksFileRaw();
			const tasks = parseTasksFile(templateTasksPath);
			expect(tasks.length).toBeGreaterThan(0);
			for (const task of tasks) {
				expect(
					Array.isArray(task.depends_on),
					`task "${String(task.title ?? task.index)}" has non-array depends_on:`,
				).toBe(true);
			}
		});
	});

	describe("spec-049: validateTaskSchema enforces depends_on and touches fields", () => {
		function getValidateTaskSchemaExtended(): (task: Record<string, unknown>) => {
			errors: string[];
			warnings: string[];
		} {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.validateTaskSchema !== "function") {
				throw new Error("validateTaskSchema not exported from spec-lint.ts");
			}
			return mod.validateTaskSchema as (task: Record<string, unknown>) => {
				errors: string[];
				warnings: string[];
			};
		}

		test("task missing touches: → error mentioning touches", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 1,
				title: "no touches",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/foo.ts"],
				depends_on: [],
				// no touches
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.join("\n")).toMatch(/touches/i);
		});

		test("task with empty touches: array → error mentioning touches non-empty", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 1,
				title: "empty touches",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/foo.ts"],
				depends_on: [],
				touches: [],
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.join("\n")).toMatch(/touches/i);
		});

		test("task with non-array touches: → error mentioning touches", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 1,
				title: "bad touches",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/foo.ts"],
				depends_on: [],
				touches: "scripts/foo.ts",
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.join("\n")).toMatch(/touches/i);
		});

		test("task with non-integer in depends_on: → error mentioning depends_on", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 1,
				title: "bad depends_on",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/foo.ts"],
				depends_on: ["prev-task"],
				touches: ["scripts/foo.ts"],
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.join("\n")).toMatch(/depends_on/i);
		});

		test("task with non-array depends_on: → error mentioning depends_on", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 1,
				title: "bad depends_on type",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/foo.ts"],
				depends_on: 1,
				touches: ["scripts/foo.ts"],
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.join("\n")).toMatch(/depends_on/i);
		});

		test("task with valid touches and depends_on → no new errors from these fields", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 1,
				title: "valid task",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/foo.ts"],
				depends_on: [],
				touches: ["scripts/foo.ts"],
			});
			// errors must be empty (depends_on + touches are valid)
			expect(result.errors).toEqual([]);
		});

		test("task with integer-filled depends_on and valid touches → no errors", () => {
			const validateTaskSchema = getValidateTaskSchemaExtended();
			const result = validateTaskSchema({
				index: 3,
				title: "depends on others",
				file_targets: ["scripts/bar.ts"],
				boundary: ["scripts/bar.ts"],
				depends_on: [1, 2],
				touches: ["scripts/bar.ts"],
			});
			expect(result.errors).toEqual([]);
		});
	});

	describe("spec-049: validateTaskSchema cross-checks touches against boundary", () => {
		test("validateTaskSchema: touches path not matching any boundary glob → error mentioning touches or boundary", () => {
			// NEW behavior (slice 1): validateTaskSchema must reject a task whose touches:
			// entries fall outside the declared boundary: globs. This is a schema-level
			// cross-check distinct from validateBoundary's file-existence check.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.validateTaskSchema !== "function") {
				throw new Error("validateTaskSchema not exported from spec-lint.ts");
			}
			const validateTaskSchema = mod.validateTaskSchema as (task: Record<string, unknown>) => {
				errors: string[];
				warnings: string[];
			};

			const result = validateTaskSchema({
				index: 1,
				title: "touches outside boundary",
				file_targets: ["scripts/foo.ts"],
				boundary: ["scripts/*.ts"],
				depends_on: [],
				touches: ["src/outside.ts"],
			});
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors.join("\n")).toMatch(/touches|boundary/i);
		});
	});

	describe("spec-049: parseTasksFile round-trip for depends_on and touches fields", () => {
		test("parseTasksFile parses depends_on and touches from a synthetic tasks.md fixture", () => {
			// Pin the parser contract: both fields must appear on the parsed task object.
			// This is independent of _template/tasks.md content evolution.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.parseTasksFile !== "function") {
				throw new Error("parseTasksFile not exported from spec-lint.ts");
			}
			const parseTasksFile = mod.parseTasksFile as (
				path: string,
			) => readonly Record<string, unknown>[];
			const { writeFileSync, mkdtempSync } = require("node:fs") as typeof import("node:fs");
			const { join } = require("node:path") as typeof import("node:path");
			const { tmpdir } = require("node:os") as typeof import("node:os");
			const tmp = mkdtempSync(join(tmpdir(), "spec-lint-049-roundtrip-"));
			const tasksPath = join(tmp, "tasks.md");
			writeFileSync(
				tasksPath,
				[
					"# Tasks",
					"",
					"- [ ] 1. Build the widget",
					"  - agent: main",
					"  - gate: scripts/smoke-widget.ts",
					"  - file_targets: [src/widget.ts]",
					"  - boundary: [src/widget.ts]",
					"  - depends_on: [1, 2]",
					"  - touches: [foo.ts, bar.ts]",
					"",
				].join("\n"),
			);
			const tasks = parseTasksFile(tasksPath);
			expect(tasks.length).toBe(1);
			const task = tasks[0];
			expect(task).toBeDefined();
			if (!task) throw new Error("task is undefined");
			// depends_on must be present and be an array containing 1 and 2
			expect(Object.hasOwn(task, "depends_on")).toBe(true);
			const dependsOn = task.depends_on;
			expect(Array.isArray(dependsOn)).toBe(true);
			expect((dependsOn as unknown[]).length).toBe(2);
			// touches must be present and contain foo.ts and bar.ts
			expect(Object.hasOwn(task, "touches")).toBe(true);
			const touches = task.touches;
			expect(Array.isArray(touches)).toBe(true);
			expect(touches as string[]).toContain("foo.ts");
			expect(touches as string[]).toContain("bar.ts");
		});
	});

	// ----------------------------------------------------------------
	// spec-039: parseTasksFile captures per-task gate: field
	// ----------------------------------------------------------------
	describe("parseTasksFile — gate: field parsing (spec-039)", () => {
		function getParseTasksFile(): (
			path: string,
		) => readonly { gate?: string | undefined; title: string; file_targets: readonly string[] }[] {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const mod = require("./spec-lint.ts") as Record<string, unknown>;
			if (typeof mod.parseTasksFile !== "function") {
				throw new Error("parseTasksFile is not exported from spec-lint.ts");
			}
			return mod.parseTasksFile as (
				path: string,
			) => readonly { gate?: string | undefined; title: string; file_targets: readonly string[] }[];
		}

		test("task with gate: field is parsed correctly", () => {
			const parseTasksFile = getParseTasksFile();
			const { writeFileSync, mkdtempSync } = require("node:fs") as typeof import("node:fs");
			const { join } = require("node:path") as typeof import("node:path");
			const { tmpdir } = require("node:os") as typeof import("node:os");
			const tmp = mkdtempSync(join(tmpdir(), "spec-lint-gate-test-"));
			const tasksPath = join(tmp, "tasks.md");
			writeFileSync(
				tasksPath,
				[
					"# Tasks",
					"",
					"- [ ] 1. First slice",
					"  - agent: main",
					"  - depends: []",
					"  - gate: scripts/smoke-foo.ts",
					"  - file_targets: [src/foo.ts]",
					"  - boundary: [src/foo.ts]",
					"",
				].join("\n"),
			);
			const tasks = parseTasksFile(tasksPath);
			expect(tasks.length).toBe(1);
			expect(tasks[0]?.gate).toBe("scripts/smoke-foo.ts");
			expect(tasks[0]?.title).toBe("1. First slice");
		});

		test("task without gate: field has gate undefined", () => {
			const parseTasksFile = getParseTasksFile();
			const { writeFileSync, mkdtempSync } = require("node:fs") as typeof import("node:fs");
			const { join } = require("node:path") as typeof import("node:path");
			const { tmpdir } = require("node:os") as typeof import("node:os");
			const tmp = mkdtempSync(join(tmpdir(), "spec-lint-no-gate-test-"));
			const tasksPath = join(tmp, "tasks.md");
			writeFileSync(
				tasksPath,
				[
					"# Tasks",
					"",
					"- [ ] 1. Non-code task",
					"  - agent: main",
					"  - depends: []",
					"  - file_targets: [scripts/foo.ts]",
					"  - boundary: [scripts/foo.ts]",
					"",
				].join("\n"),
			);
			const tasks = parseTasksFile(tasksPath);
			expect(tasks.length).toBe(1);
			expect(tasks[0]?.gate).toBeUndefined();
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
