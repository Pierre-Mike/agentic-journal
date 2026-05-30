/**
 * Outer gate (unit): slice runner self-validation loop foundation — spec 123
 *
 * Structural deliverables check. RED at scaffold — GREEN after slices 1–2 land.
 *
 * Asserts:
 *   1. scripts/slice/local-ci.ts exists and exports runLocalCi + CI_STEPS (6 entries)
 *   2. scripts/slice/loop.ts exists and exports runLoop
 *   3. CI_STEPS order: typecheck → lint:ci → spec:lint → tasks:verify → test → gate
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "../..");
const LOCAL_CI_PATH = join(REPO_ROOT, "scripts/slice/local-ci.ts");
const LOOP_PATH = join(REPO_ROOT, "scripts/slice/loop.ts");

// ---------------------------------------------------------------------------
// 1. File existence
// ---------------------------------------------------------------------------

describe("deliverables: scripts/slice/ files exist", () => {
	test("scripts/slice/local-ci.ts exists", () => {
		expect(existsSync(LOCAL_CI_PATH)).toBe(true);
	});

	test("scripts/slice/loop.ts exists", () => {
		expect(existsSync(LOOP_PATH)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// 2. local-ci.ts: exported API contract
// ---------------------------------------------------------------------------

describe("local-ci.ts: exported API", () => {
	async function load(): Promise<Record<string, unknown>> {
		return import(LOCAL_CI_PATH);
	}

	test("exports runLocalCi function", async () => {
		const mod = await load();
		expect(typeof mod.runLocalCi).toBe("function");
	});

	test("exports CI_STEPS array with exactly 6 entries", async () => {
		const mod = await load();
		expect(Array.isArray(mod.CI_STEPS)).toBe(true);
		expect((mod.CI_STEPS as unknown[]).length).toBe(6);
	});

	test("CI_STEPS are in expected order", async () => {
		const mod = await load();
		expect(mod.CI_STEPS).toEqual([
			"typecheck",
			"lint:ci",
			"spec:lint",
			"tasks:verify",
			"test",
			"gate",
		]);
	});
});

// ---------------------------------------------------------------------------
// 3. loop.ts: exported API contract
// ---------------------------------------------------------------------------

describe("loop.ts: exported API", () => {
	async function load(): Promise<Record<string, unknown>> {
		return import(LOOP_PATH);
	}

	test("exports runLoop function", async () => {
		const mod = await load();
		expect(typeof mod.runLoop).toBe("function");
	});
});
