/**
 * BDD integration gate for spec 053: auto:age script.
 *
 * RED at scaffold — GREEN only after both slices complete:
 *   slice 1: parseAgeBuckets + formatAgeLine + scripts/auto-age-buckets.ts
 *   slice 2: main() entry point + package.json auto:age registration
 *
 * Tests structural deliverables (file existence, package.json entry, exported
 * API) via dynamic import. No real gh invocations.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Deliverables exist
// ---------------------------------------------------------------------------

describe("deliverables exist", () => {
	test("scripts/auto-age-buckets.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/auto-age-buckets.ts"))).toBe(true);
	});

	test("scripts/auto-age-buckets.test.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/auto-age-buckets.test.ts"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// package.json: auto:age registration
// ---------------------------------------------------------------------------

describe("package.json: auto:age registration", () => {
	function readPkg() {
		return JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
			scripts?: Record<string, string>;
		};
	}

	test('package.json has "auto:age" script', () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["auto:age"]).toBeDefined();
	});

	test("auto:age script references auto-age-buckets.ts", () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["auto:age"]).toMatch(/auto-age-buckets/);
	});
});

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

describe("scripts/auto-age-buckets.ts: exported API", () => {
	async function loadModule(): Promise<Record<string, unknown>> {
		return import(join(REPO_ROOT, "scripts/auto-age-buckets.ts"));
	}

	test("exports parseAgeBuckets function", async () => {
		const mod = await loadModule();
		expect(typeof mod.parseAgeBuckets).toBe("function");
	});

	test("exports formatAgeLine function", async () => {
		const mod = await loadModule();
		expect(typeof mod.formatAgeLine).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// Contract: parseAgeBuckets behavior via dynamic import (frozen now)
// ---------------------------------------------------------------------------

const FROZEN_NOW = new Date("2026-04-30T12:00:00.000Z");

describe("parseAgeBuckets: bucket extraction", () => {
	async function parseAgeBuckets(
		json: string,
		now: Date,
	): Promise<{ ltOneHour: number; oneToTwentyFour: number; gtTwentyFour: number }> {
		const mod = await import(join(REPO_ROOT, "scripts/auto-age-buckets.ts"));
		return (
			mod.parseAgeBuckets as (
				j: string,
				n: Date,
			) => { ltOneHour: number; oneToTwentyFour: number; gtTwentyFour: number }
		)(json, now);
	}

	test("empty array → zero buckets", async () => {
		expect(await parseAgeBuckets("[]", FROZEN_NOW)).toEqual({
			ltOneHour: 0,
			oneToTwentyFour: 0,
			gtTwentyFour: 0,
		});
	});

	test("mixed-bucket fixture → correct counts", async () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-recent", createdAt: "2026-04-30T11:30:00.000Z" },
			{ headRefName: "auto/2-middle", createdAt: "2026-04-30T00:00:00.000Z" },
			{ headRefName: "auto/3-old", createdAt: "2026-04-28T00:00:00.000Z" },
		]);
		expect(await parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 1,
			oneToTwentyFour: 1,
			gtTwentyFour: 1,
		});
	});
});

// ---------------------------------------------------------------------------
// Contract: formatAgeLine exact output
// ---------------------------------------------------------------------------

describe("formatAgeLine: output format", () => {
	async function formatAgeLine(buckets: {
		ltOneHour: number;
		oneToTwentyFour: number;
		gtTwentyFour: number;
	}): Promise<string> {
		const mod = await import(join(REPO_ROOT, "scripts/auto-age-buckets.ts"));
		return (
			mod.formatAgeLine as (b: {
				ltOneHour: number;
				oneToTwentyFour: number;
				gtTwentyFour: number;
			}) => string
		)(buckets);
	}

	test("zero state → '0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h'", async () => {
		expect(await formatAgeLine({ ltOneHour: 0, oneToTwentyFour: 0, gtTwentyFour: 0 })).toBe(
			"0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h",
		);
	});

	test("round-trip matches exact format", async () => {
		const mod = await import(join(REPO_ROOT, "scripts/auto-age-buckets.ts"));
		const parse = mod.parseAgeBuckets as (
			j: string,
			n: Date,
		) => { ltOneHour: number; oneToTwentyFour: number; gtTwentyFour: number };
		const fmt = mod.formatAgeLine as (b: {
			ltOneHour: number;
			oneToTwentyFour: number;
			gtTwentyFour: number;
		}) => string;
		const json = JSON.stringify([
			{ headRefName: "auto/1-recent", createdAt: "2026-04-30T11:30:00.000Z" },
			{ headRefName: "auto/2-middle", createdAt: "2026-04-30T00:00:00.000Z" },
			{ headRefName: "auto/3-old", createdAt: "2026-04-28T00:00:00.000Z" },
		]);
		expect(fmt(parse(json, FROZEN_NOW))).toBe("3 branches in flight: 1 < 1h, 1 1-24h, 1 > 24h");
	});
});
