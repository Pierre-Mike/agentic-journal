/**
 * BDD outer-gate for spec 052: auto:status script
 *
 * RED at scaffold: scripts/auto-status.ts does not exist yet — the import
 * below will throw a module-not-found error, failing all tests.
 *
 * GREEN after slice 1 implements parsePrList + formatLine and slice 2 wires
 * up main() and the package.json entry.
 *
 * Tests pure functions only — no subprocess calls, no real gh invocation.
 */

import { describe, expect, test } from "bun:test";
import { formatLine, parsePrList } from "./auto-status.ts";

// ---------------------------------------------------------------------------
// parsePrList — tally extraction from raw gh JSON
// ---------------------------------------------------------------------------

describe("parsePrList", () => {
	test("empty array → zero tally", () => {
		expect(parsePrList("[]")).toEqual({ draft: 0, open: 0, closed: 0 });
	});

	test("non-auto/ branch is filtered out", () => {
		const json = JSON.stringify([{ headRefName: "main", state: "OPEN", isDraft: false }]);
		expect(parsePrList(json)).toEqual({ draft: 0, open: 0, closed: 0 });
	});

	test("OPEN + isDraft:true → draft bucket", () => {
		const json = JSON.stringify([{ headRefName: "auto/101-test", state: "OPEN", isDraft: true }]);
		expect(parsePrList(json)).toEqual({ draft: 1, open: 0, closed: 0 });
	});

	test("OPEN + isDraft:false → open bucket", () => {
		const json = JSON.stringify([{ headRefName: "auto/101-test", state: "OPEN", isDraft: false }]);
		expect(parsePrList(json)).toEqual({ draft: 0, open: 1, closed: 0 });
	});

	test("CLOSED → closed bucket", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/101-test", state: "CLOSED", isDraft: false },
		]);
		expect(parsePrList(json)).toEqual({ draft: 0, open: 0, closed: 1 });
	});

	test("MERGED → closed bucket (folded, not a 4th column)", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/101-test", state: "MERGED", isDraft: false },
		]);
		expect(parsePrList(json)).toEqual({ draft: 0, open: 0, closed: 1 });
	});

	test("mixed-state fixture: 1 draft + 1 open + 1 merged + 1 non-auto filtered", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-draft-pr", state: "OPEN", isDraft: true },
			{ headRefName: "auto/2-open-pr", state: "OPEN", isDraft: false },
			{ headRefName: "auto/3-merged-pr", state: "MERGED", isDraft: false },
			{ headRefName: "other/4-ignored", state: "OPEN", isDraft: false },
		]);
		expect(parsePrList(json)).toEqual({ draft: 1, open: 1, closed: 1 });
	});

	test("all-closed fixture: CLOSED + MERGED both land in closed", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-closed", state: "CLOSED", isDraft: false },
			{ headRefName: "auto/2-merged", state: "MERGED", isDraft: false },
		]);
		expect(parsePrList(json)).toEqual({ draft: 0, open: 0, closed: 2 });
	});
});

// ---------------------------------------------------------------------------
// formatLine — exact output format
// ---------------------------------------------------------------------------

describe("formatLine", () => {
	test("zero state → '0 branches in flight: 0 draft, 0 open, 0 closed'", () => {
		expect(formatLine({ draft: 0, open: 0, closed: 0 })).toBe(
			"0 branches in flight: 0 draft, 0 open, 0 closed",
		);
	});

	test("N = draft + open + closed (total)", () => {
		expect(formatLine({ draft: 1, open: 2, closed: 3 })).toBe(
			"6 branches in flight: 1 draft, 2 open, 3 closed",
		);
	});

	test("all-closed: N equals closed count", () => {
		expect(formatLine({ draft: 0, open: 0, closed: 5 })).toBe(
			"5 branches in flight: 0 draft, 0 open, 5 closed",
		);
	});

	test("single draft only", () => {
		expect(formatLine({ draft: 1, open: 0, closed: 0 })).toBe(
			"1 branches in flight: 1 draft, 0 open, 0 closed",
		);
	});
});

// ---------------------------------------------------------------------------
// round-trip: parsePrList → formatLine
// ---------------------------------------------------------------------------

describe("round-trip", () => {
	test("mixed-state fixture produces exact output line", () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-draft-pr", state: "OPEN", isDraft: true },
			{ headRefName: "auto/2-open-pr", state: "OPEN", isDraft: false },
			{ headRefName: "auto/3-merged-pr", state: "MERGED", isDraft: false },
		]);
		expect(formatLine(parsePrList(json))).toBe("3 branches in flight: 1 draft, 1 open, 1 closed");
	});

	test("empty array produces zero-state line", () => {
		expect(formatLine(parsePrList("[]"))).toBe("0 branches in flight: 0 draft, 0 open, 0 closed");
	});
});
