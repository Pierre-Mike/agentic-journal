/**
 * BDD integration gate for spec 052: auto:status script.
 *
 * RED at scaffold — GREEN only after both slices complete:
 *   slice 1: parsePrList + formatLine + scripts/auto-status.ts
 *   slice 2: main() entry point + package.json auto:status registration
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
	test("scripts/auto-status.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/auto-status.ts"))).toBe(true);
	});

	test("scripts/auto-status.test.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/auto-status.test.ts"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// package.json: auto:status registration
// ---------------------------------------------------------------------------

describe("package.json: auto:status registration", () => {
	function readPkg() {
		return JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
			scripts?: Record<string, string>;
		};
	}

	test('package.json has "auto:status" script', () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["auto:status"]).toBeDefined();
	});

	test("auto:status script references auto-status.ts", () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["auto:status"]).toMatch(/auto-status/);
	});
});

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

describe("scripts/auto-status.ts: exported API", () => {
	async function loadModule(): Promise<Record<string, unknown>> {
		return import(join(REPO_ROOT, "scripts/auto-status.ts"));
	}

	test("exports parsePrList function", async () => {
		const mod = await loadModule();
		expect(typeof mod.parsePrList).toBe("function");
	});

	test("exports formatLine function", async () => {
		const mod = await loadModule();
		expect(typeof mod.formatLine).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// Contract: parsePrList behavior via dynamic import
// ---------------------------------------------------------------------------

describe("parsePrList: tally extraction", () => {
	async function parsePrList(
		json: string,
	): Promise<{ draft: number; open: number; closed: number }> {
		const mod = await import(join(REPO_ROOT, "scripts/auto-status.ts"));
		return (mod.parsePrList as (j: string) => { draft: number; open: number; closed: number })(
			json,
		);
	}

	test("empty array → zero tally", async () => {
		expect(await parsePrList("[]")).toEqual({ draft: 0, open: 0, closed: 0 });
	});

	test("mixed-state fixture → correct buckets", async () => {
		const json = JSON.stringify([
			{ headRefName: "auto/1-draft", state: "OPEN", isDraft: true },
			{ headRefName: "auto/2-open", state: "OPEN", isDraft: false },
			{ headRefName: "auto/3-merged", state: "MERGED", isDraft: false },
		]);
		expect(await parsePrList(json)).toEqual({ draft: 1, open: 1, closed: 1 });
	});
});

// ---------------------------------------------------------------------------
// Contract: formatLine exact output
// ---------------------------------------------------------------------------

describe("formatLine: output format", () => {
	async function formatLine(tally: {
		draft: number;
		open: number;
		closed: number;
	}): Promise<string> {
		const mod = await import(join(REPO_ROOT, "scripts/auto-status.ts"));
		return (mod.formatLine as (t: { draft: number; open: number; closed: number }) => string)(
			tally,
		);
	}

	test("zero state → '0 branches in flight: 0 draft, 0 open, 0 closed'", async () => {
		expect(await formatLine({ draft: 0, open: 0, closed: 0 })).toBe(
			"0 branches in flight: 0 draft, 0 open, 0 closed",
		);
	});

	test("round-trip matches exact format", async () => {
		const mod = await import(join(REPO_ROOT, "scripts/auto-status.ts"));
		const parsePrList = mod.parsePrList as (j: string) => {
			draft: number;
			open: number;
			closed: number;
		};
		const fmtLine = mod.formatLine as (t: {
			draft: number;
			open: number;
			closed: number;
		}) => string;
		const json = JSON.stringify([
			{ headRefName: "auto/1-draft", state: "OPEN", isDraft: true },
			{ headRefName: "auto/2-open", state: "OPEN", isDraft: false },
			{ headRefName: "auto/3-merged", state: "MERGED", isDraft: false },
		]);
		expect(fmtLine(parsePrList(json))).toBe("3 branches in flight: 1 draft, 1 open, 1 closed");
	});
});
