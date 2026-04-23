/**
 * Unit tests for scripts/_lib.ts helpers.
 *
 * Comprehensive gateEntries() tests are colocated in scripts/spec-lint.test.ts
 * (they were written there as spec-032 gate tests). This file covers the
 * remaining helpers: gatePaths, isReady, unresolvedDeps.
 */

import { describe, expect, test } from "bun:test";
import { gateEntries, gatePaths, isReady, unresolvedDeps } from "./_lib.ts";

const makeSpec = (gate: unknown, depends_on: string[] = []) => ({
	slug: "test",
	dir: "/tmp/test",
	frontmatter: {
		id: "001",
		title: "test",
		status: "active" as const,
		kind: "code" as const,
		gate: gate as string,
		created: "2026-01-01",
		owner: "main",
		depends_on,
		supersedes: null,
	},
	body: "",
});

describe("gatePaths", () => {
	test("scalar → single-element array", () => {
		expect(gatePaths(makeSpec("src/foo.test.ts"))).toEqual(["src/foo.test.ts"]);
	});

	test("string array → same array", () => {
		expect(gatePaths(makeSpec(["a.ts", "b.ts"]))).toEqual(["a.ts", "b.ts"]);
	});

	test("typed list → path array", () => {
		expect(
			gatePaths(
				makeSpec([
					{ path: "src/foo.test.ts", level: "unit" },
					{ path: "scripts/smoke.ts", level: "e2e" },
				]),
			),
		).toEqual(["src/foo.test.ts", "scripts/smoke.ts"]);
	});
});

describe("gateEntries", () => {
	test("scalar → unit entry", () => {
		expect(gateEntries(makeSpec("src/foo.test.ts"))).toEqual([
			{ path: "src/foo.test.ts", level: "unit" },
		]);
	});

	test("string[] → all unit entries", () => {
		expect(gateEntries(makeSpec(["a.test.ts", "b.test.ts"]))).toEqual([
			{ path: "a.test.ts", level: "unit" },
			{ path: "b.test.ts", level: "unit" },
		]);
	});

	test("typed list → passes through with validation", () => {
		const entries = gateEntries(
			makeSpec([
				{ path: "src/foo.test.ts", level: "unit" },
				{ path: "scripts/smoke.ts", level: "e2e" },
			]),
		);
		expect(entries).toEqual([
			{ path: "src/foo.test.ts", level: "unit" },
			{ path: "scripts/smoke.ts", level: "e2e" },
		]);
	});

	test("empty array → empty", () => {
		expect(gateEntries(makeSpec([]))).toEqual([]);
	});
});

describe("isReady", () => {
	test("no dependencies → ready", () => {
		expect(isReady(makeSpec("x.ts"), new Set())).toBe(true);
	});

	test("dep in archived set → ready", () => {
		expect(isReady(makeSpec("x.ts", ["001"]), new Set(["001"]))).toBe(true);
	});

	test("dep not archived → not ready", () => {
		expect(isReady(makeSpec("x.ts", ["001"]), new Set())).toBe(false);
	});
});

describe("unresolvedDeps", () => {
	test("no deps → empty", () => {
		expect(unresolvedDeps(makeSpec("x.ts"), new Set())).toEqual([]);
	});

	test("archived dep → resolved", () => {
		expect(unresolvedDeps(makeSpec("x.ts", ["001"]), new Set(["001"]))).toEqual([]);
	});

	test("missing dep → listed", () => {
		expect(unresolvedDeps(makeSpec("x.ts", ["001", "002"]), new Set(["001"]))).toEqual(["002"]);
	});
});
