/**
 * BDD outer-gate for spec 053: auto:age script
 *
 * RED at scaffold: scripts/auto-age-buckets.ts does not exist yet — the import
 * below will throw a module-not-found error, failing all tests.
 *
 * GREEN after slice 1 implements parseAgeBuckets + formatAgeLine and slice 2 wires
 * up main() and the package.json entry.
 *
 * Tests pure functions only — no subprocess calls, no real gh invocation.
 * now is frozen at FROZEN_NOW for deterministic bucket classification.
 */

import { describe, expect, test } from "bun:test";
import { formatAgeLine, parseAgeBuckets } from "./auto-age-buckets.ts";

// Frozen reference point for all age bucket tests.
// FROZEN_NOW - 3600s  = 2026-04-30T11:00:00.000Z  (< 1h boundary)
// FROZEN_NOW - 86400s = 2026-04-29T12:00:00.000Z  (1-24h boundary)
const FROZEN_NOW = new Date("2026-04-30T12:00:00.000Z");

// ---------------------------------------------------------------------------
// parseAgeBuckets — age classification from raw gh JSON
// ---------------------------------------------------------------------------

describe("parseAgeBuckets", () => {
	test("empty array → zero buckets", () => {
		expect(parseAgeBuckets("[]", FROZEN_NOW)).toEqual({
			ltOneHour: 0,
			oneToTwentyFour: 0,
			gtTwentyFour: 0,
		});
	});

	test("non-auto/ branch is filtered out", () => {
		const json = JSON.stringify([{ headRefName: "main", createdAt: "2026-04-30T11:30:00.000Z" }]);
		expect(parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 0,
			oneToTwentyFour: 0,
			gtTwentyFour: 0,
		});
	});

	test("30 min ago → ltOneHour bucket", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/101-test", createdAt: "2026-04-30T11:30:00.000Z" },
		]);
		expect(parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 1,
			oneToTwentyFour: 0,
			gtTwentyFour: 0,
		});
	});

	test("12 hours ago → oneToTwentyFour bucket", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/102-test", createdAt: "2026-04-30T00:00:00.000Z" },
		]);
		expect(parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 0,
			oneToTwentyFour: 1,
			gtTwentyFour: 0,
		});
	});

	test("2 days ago → gtTwentyFour bucket", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/103-test", createdAt: "2026-04-28T00:00:00.000Z" },
		]);
		expect(parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 0,
			oneToTwentyFour: 0,
			gtTwentyFour: 1,
		});
	});

	test("all-in-one-bucket: three branches each < 1h", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-a", createdAt: "2026-04-30T11:55:00.000Z" },
			{ headRefName: "auto/1-b", createdAt: "2026-04-30T11:45:00.000Z" },
			{ headRefName: "auto/1-c", createdAt: "2026-04-30T11:01:00.000Z" },
		]);
		expect(parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 3,
			oneToTwentyFour: 0,
			gtTwentyFour: 0,
		});
	});

	test("mixed buckets: one per bucket + one non-auto filtered", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-recent", createdAt: "2026-04-30T11:30:00.000Z" },
			{ headRefName: "auto/2-middle", createdAt: "2026-04-30T00:00:00.000Z" },
			{ headRefName: "auto/3-old", createdAt: "2026-04-28T00:00:00.000Z" },
			{ headRefName: "other/4-ignored", createdAt: "2026-04-30T11:59:00.000Z" },
		]);
		expect(parseAgeBuckets(json, FROZEN_NOW)).toEqual({
			ltOneHour: 1,
			oneToTwentyFour: 1,
			gtTwentyFour: 1,
		});
	});
});

// ---------------------------------------------------------------------------
// formatAgeLine — exact output format
// ---------------------------------------------------------------------------

describe("formatAgeLine", () => {
	test("zero state → '0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h'", () => {
		expect(formatAgeLine({ ltOneHour: 0, oneToTwentyFour: 0, gtTwentyFour: 0 })).toBe(
			"0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h",
		);
	});

	test("N = ltOneHour + oneToTwentyFour + gtTwentyFour (total)", () => {
		expect(formatAgeLine({ ltOneHour: 1, oneToTwentyFour: 2, gtTwentyFour: 3 })).toBe(
			"6 branches in flight: 1 < 1h, 2 1-24h, 3 > 24h",
		);
	});

	test("all in gtTwentyFour", () => {
		expect(formatAgeLine({ ltOneHour: 0, oneToTwentyFour: 0, gtTwentyFour: 5 })).toBe(
			"5 branches in flight: 0 < 1h, 0 1-24h, 5 > 24h",
		);
	});

	test("single ltOneHour only", () => {
		expect(formatAgeLine({ ltOneHour: 1, oneToTwentyFour: 0, gtTwentyFour: 0 })).toBe(
			"1 branches in flight: 1 < 1h, 0 1-24h, 0 > 24h",
		);
	});
});

// ---------------------------------------------------------------------------
// round-trip: parseAgeBuckets → formatAgeLine
// ---------------------------------------------------------------------------

describe("round-trip", () => {
	test("mixed-bucket fixture produces exact output line", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-recent", createdAt: "2026-04-30T11:30:00.000Z" },
			{ headRefName: "auto/2-middle", createdAt: "2026-04-30T00:00:00.000Z" },
			{ headRefName: "auto/3-old", createdAt: "2026-04-28T00:00:00.000Z" },
		]);
		expect(formatAgeLine(parseAgeBuckets(json, FROZEN_NOW))).toBe(
			"3 branches in flight: 1 < 1h, 1 1-24h, 1 > 24h",
		);
	});

	test("empty array produces zero-state line", () => {
		expect(formatAgeLine(parseAgeBuckets("[]", FROZEN_NOW))).toBe(
			"0 branches in flight: 0 < 1h, 0 1-24h, 0 > 24h",
		);
	});
});
