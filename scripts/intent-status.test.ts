/**
 * Unit tests for scripts/intent-status.ts
 *
 * RED at scaffold: import fails because scripts/intent-status.ts does not exist yet.
 * GREEN after slice 1 implements formatAge, parseBranch, and formatTable.
 *
 * Tests pure functions only — no subprocess calls.
 */

import { describe, expect, test } from "bun:test";
import { formatAge, formatTable, parseBranch } from "./intent-status.ts";

// ---------------------------------------------------------------------------
// formatAge
// ---------------------------------------------------------------------------

describe("formatAge", () => {
	test("0 days 2 hours → '0d  2h'", () => {
		expect(formatAge(2 * 3600)).toBe("0d  2h");
	});

	test("1 day 0 hours → '1d  0h'", () => {
		expect(formatAge(86400)).toBe("1d  0h");
	});

	test("3 days 14 hours → '3d 14h'", () => {
		expect(formatAge(3 * 86400 + 14 * 3600)).toBe("3d 14h");
	});

	test("fractional hours are floored (1h 59m → '0d  1h')", () => {
		expect(formatAge(3600 + 59 * 60)).toBe("0d  1h");
	});

	test("0 seconds → '0d  0h'", () => {
		expect(formatAge(0)).toBe("0d  0h");
	});
});

// ---------------------------------------------------------------------------
// parseBranch
// ---------------------------------------------------------------------------

describe("parseBranch", () => {
	test("origin/auto/93-add-intent-status-script → issue 93, slug correct", () => {
		const r = parseBranch("origin/auto/93-add-intent-status-script");
		expect(r).not.toBeNull();
		expect(r?.issue).toBe(93);
		expect(r?.slug).toBe("add-intent-status-script");
	});

	test("refs/remotes/origin/auto/87-another-branch → issue 87", () => {
		const r = parseBranch("refs/remotes/origin/auto/87-another-branch");
		expect(r).not.toBeNull();
		expect(r?.issue).toBe(87);
		expect(r?.slug).toBe("another-branch");
	});

	test("auto/1-short-slug → issue 1", () => {
		const r = parseBranch("auto/1-short-slug");
		expect(r).not.toBeNull();
		expect(r?.issue).toBe(1);
		expect(r?.slug).toBe("short-slug");
	});

	test("slug with multiple hyphens is preserved in full", () => {
		const r = parseBranch("origin/auto/93-add-intent-status-in-flight");
		expect(r?.slug).toBe("add-intent-status-in-flight");
	});

	test("origin/main → null (not an auto branch)", () => {
		expect(parseBranch("origin/main")).toBeNull();
	});

	test("feature/no-number → null (no issue number)", () => {
		expect(parseBranch("feature/no-number")).toBeNull();
	});

	test("bare 'main' → null", () => {
		expect(parseBranch("main")).toBeNull();
	});

	test("origin/auto/ with no suffix → null (malformed)", () => {
		expect(parseBranch("origin/auto/")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// formatTable
// ---------------------------------------------------------------------------

describe("formatTable", () => {
	test("empty list → 'no in-flight intents.'", () => {
		expect(formatTable([])).toBe("no in-flight intents.");
	});

	test("single entry → header present and row contains #issue", () => {
		const out = formatTable([{ issue: 93, slug: "add-intent-status", ageSeconds: 7200 }]);
		expect(out).toMatch(/in-flight intents:/);
		expect(out).toContain("#93");
		expect(out).toContain("add-intent-status");
		expect(out).toContain("0d  2h");
	});

	test("rows sorted oldest-first (largest ageSeconds appears first)", () => {
		const out = formatTable([
			{ issue: 93, slug: "new-one", ageSeconds: 7200 },
			{ issue: 87, slug: "old-one", ageSeconds: 3 * 86400 + 14 * 3600 },
		]);
		const idx87 = out.indexOf("#87");
		const idx93 = out.indexOf("#93");
		expect(idx87).toBeGreaterThanOrEqual(0);
		expect(idx93).toBeGreaterThanOrEqual(0);
		expect(idx87).toBeLessThan(idx93);
	});

	test("age is rendered via formatAge ('3d 14h' for 3d 14h)", () => {
		const out = formatTable([{ issue: 87, slug: "old-one", ageSeconds: 3 * 86400 + 14 * 3600 }]);
		expect(out).toContain("3d 14h");
	});

	test("both entries appear when two are provided", () => {
		const out = formatTable([
			{ issue: 87, slug: "old-one", ageSeconds: 3 * 86400 + 14 * 3600 },
			{ issue: 93, slug: "new-one", ageSeconds: 7200 },
		]);
		expect(out).toContain("#87");
		expect(out).toContain("#93");
	});
});
