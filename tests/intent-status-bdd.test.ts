/**
 * Outer BDD acceptance gate for spec 051: intent:status script.
 *
 * RED at scaffold — GREEN only after both slices are complete:
 *   slice 1: formatAge, parseBranch, formatTable + unit tests
 *   slice 2: main() entry point + package.json intent:status registration
 *
 * Tests are structured around the acceptance criteria in proposal.md.
 * They fail at scaffold because scripts/intent-status.ts does not exist yet.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Deliverable: script and test files exist
// ---------------------------------------------------------------------------

describe("deliverables exist", () => {
	test("scripts/intent-status.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/intent-status.ts"))).toBe(true);
	});

	test("scripts/intent-status.test.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/intent-status.test.ts"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Deliverable: package.json registration
// ---------------------------------------------------------------------------

describe("package.json: intent:status registration", () => {
	function readPkg() {
		return JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
			scripts?: Record<string, string>;
		};
	}

	test('package.json has "intent:status" script', () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["intent:status"]).toBeDefined();
	});

	test("intent:status script references intent-status.ts", () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["intent:status"]).toMatch(/intent-status/);
	});
});

// ---------------------------------------------------------------------------
// Contract: exported API
// ---------------------------------------------------------------------------

describe("scripts/intent-status.ts: exported API", () => {
	async function loadModule(): Promise<Record<string, unknown>> {
		// Dynamic import: fails RED when file does not exist
		return import(join(REPO_ROOT, "scripts/intent-status.ts"));
	}

	test("exports formatAge function", async () => {
		const mod = await loadModule();
		expect(typeof mod.formatAge).toBe("function");
	});

	test("exports parseBranch function", async () => {
		const mod = await loadModule();
		expect(typeof mod.parseBranch).toBe("function");
	});

	test("exports formatTable function", async () => {
		const mod = await loadModule();
		expect(typeof mod.formatTable).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// Contract: formatAge output format
// ---------------------------------------------------------------------------

describe("formatAge: <N>d <H>h with space-padded hours", () => {
	async function formatAge(seconds: number): Promise<string> {
		const mod = await import(join(REPO_ROOT, "scripts/intent-status.ts"));
		return (mod.formatAge as (s: number) => string)(seconds);
	}

	test("0 days 2 hours → '0d  2h'", async () => {
		expect(await formatAge(2 * 3600)).toBe("0d  2h");
	});

	test("1 day 0 hours → '1d  0h'", async () => {
		expect(await formatAge(86400)).toBe("1d  0h");
	});

	test("3 days 14 hours → '3d 14h'", async () => {
		expect(await formatAge(3 * 86400 + 14 * 3600)).toBe("3d 14h");
	});

	test("fractional hours are floored (1h 59m → 1h)", async () => {
		expect(await formatAge(3600 + 59 * 60)).toBe("0d  1h");
	});
});

// ---------------------------------------------------------------------------
// Contract: parseBranch parsing
// ---------------------------------------------------------------------------

describe("parseBranch: extracts issue and slug from auto/* refs", () => {
	async function parseBranch(ref: string): Promise<{ issue: number; slug: string } | null> {
		const mod = await import(join(REPO_ROOT, "scripts/intent-status.ts"));
		return (mod.parseBranch as (r: string) => { issue: number; slug: string } | null)(ref);
	}

	test("origin/auto/93-add-intent-status-script → issue 93", async () => {
		const r = await parseBranch("origin/auto/93-add-intent-status-script");
		expect(r).not.toBeNull();
		expect(r?.issue).toBe(93);
		expect(r?.slug).toBe("add-intent-status-script");
	});

	test("refs/remotes/origin/auto/87-another-branch → issue 87", async () => {
		const r = await parseBranch("refs/remotes/origin/auto/87-another-branch");
		expect(r).not.toBeNull();
		expect(r?.issue).toBe(87);
		expect(r?.slug).toBe("another-branch");
	});

	test("origin/main → null (not an auto branch)", async () => {
		expect(await parseBranch("origin/main")).toBeNull();
	});

	test("feature/no-number → null (no issue number)", async () => {
		expect(await parseBranch("feature/no-number")).toBeNull();
	});

	test("origin/auto/ with no suffix → null (malformed)", async () => {
		expect(await parseBranch("origin/auto/")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Contract: formatTable output structure
// ---------------------------------------------------------------------------

describe("formatTable: renders sorted status table", () => {
	async function formatTable(
		entries: Array<{ issue: number; slug: string; ageSeconds: number }>,
	): Promise<string> {
		const mod = await import(join(REPO_ROOT, "scripts/intent-status.ts"));
		return (
			mod.formatTable as (e: Array<{ issue: number; slug: string; ageSeconds: number }>) => string
		)(entries);
	}

	test("empty list → 'no in-flight intents.'", async () => {
		expect(await formatTable([])).toBe("no in-flight intents.");
	});

	test("non-empty → contains header 'in-flight intents:'", async () => {
		const out = await formatTable([{ issue: 93, slug: "add-intent-status", ageSeconds: 7200 }]);
		expect(out).toMatch(/in-flight intents:/);
	});

	test("non-empty → rows contain #<issue>", async () => {
		const out = await formatTable([{ issue: 93, slug: "add-intent-status", ageSeconds: 7200 }]);
		expect(out).toContain("#93");
	});

	test("non-empty → rows contain the slug", async () => {
		const out = await formatTable([{ issue: 93, slug: "add-intent-status", ageSeconds: 7200 }]);
		expect(out).toContain("add-intent-status");
	});

	test("rows sorted oldest-first (largest ageSeconds appears first)", async () => {
		const out = await formatTable([
			{ issue: 93, slug: "new-one", ageSeconds: 7200 },
			{ issue: 87, slug: "old-one", ageSeconds: 3 * 86400 + 14 * 3600 },
		]);
		const idx87 = out.indexOf("#87");
		const idx93 = out.indexOf("#93");
		expect(idx87).toBeGreaterThanOrEqual(0);
		expect(idx93).toBeGreaterThanOrEqual(0);
		expect(idx87).toBeLessThan(idx93);
	});

	test("rows contain formatted age via formatAge", async () => {
		// 3 days 14 hours → '3d 14h'
		const out = await formatTable([
			{ issue: 87, slug: "old-one", ageSeconds: 3 * 86400 + 14 * 3600 },
		]);
		expect(out).toContain("3d 14h");
	});
});
