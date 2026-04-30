/**
 * BDD integration gate for spec 055: pipeline:report script.
 *
 * RED at scaffold:
 *   - scripts/pipeline-report.ts does not exist → existsSync → false
 *   - package.json has no pipeline:report entry → test fails
 *   - dynamic import of missing module → API shape tests fail
 *
 * GREEN after both slices complete:
 *   slice 1: parseTraceContent + buildReport + formatReport + Zod schemas
 *   slice 2: main() entry point + package.json pipeline:report registration
 *
 * No real .claude/traces/ reads — tests use dynamic import + fs checks only.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Deliverables exist
// ---------------------------------------------------------------------------

describe("deliverables exist", () => {
	test("scripts/pipeline-report.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/pipeline-report.ts"))).toBe(true);
	});

	test("scripts/pipeline-report.test.ts exists", () => {
		expect(existsSync(join(REPO_ROOT, "scripts/pipeline-report.test.ts"))).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// package.json: pipeline:report registration
// ---------------------------------------------------------------------------

describe("package.json: pipeline:report registration", () => {
	function readPkg() {
		return JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
			scripts?: Record<string, string>;
		};
	}

	test('package.json has "pipeline:report" script', () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["pipeline:report"]).toBeDefined();
	});

	test("pipeline:report script references pipeline-report.ts", () => {
		const pkg = readPkg();
		expect(pkg.scripts?.["pipeline:report"]).toMatch(/pipeline-report/);
	});
});

// ---------------------------------------------------------------------------
// Exported API shape
// ---------------------------------------------------------------------------

describe("scripts/pipeline-report.ts: exported API", () => {
	async function loadModule(): Promise<Record<string, unknown>> {
		return import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
	}

	test("exports parseTraceContent function", async () => {
		const mod = await loadModule();
		expect(typeof mod.parseTraceContent).toBe("function");
	});

	test("exports buildReport function", async () => {
		const mod = await loadModule();
		expect(typeof mod.buildReport).toBe("function");
	});

	test("exports formatReport function", async () => {
		const mod = await loadModule();
		expect(typeof mod.formatReport).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// Contract: buildReport + formatReport via dynamic import (no disk I/O)
// ---------------------------------------------------------------------------

const FIXTURE_SESSION = [
	'{"type":"token_usage","session_id":"aaaa1111","input_tokens":10,"output_tokens":5,"started_at":"2026-04-30T10:00:00.000Z","duration_ms":1000}',
	'{"type":"tool_use","session_id":"aaaa1111","tool":"Read"}',
].join("\n");

describe("pipeline-report contract: empty → 'no trace data yet.'", () => {
	test("formatReport on empty buildReport returns sentinel string", async () => {
		const mod = await import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
		const buildReport = mod.buildReport as (files: Record<string, string>) => unknown;
		const formatReport = mod.formatReport as (data: unknown) => string;
		expect(formatReport(buildReport({}))).toBe("no trace data yet.");
	});
});

describe("pipeline-report contract: single session output structure", () => {
	test("output contains sessions header with token counts", async () => {
		const mod = await import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
		const buildReport = mod.buildReport as (files: Record<string, string>) => unknown;
		const formatReport = mod.formatReport as (data: unknown) => string;
		const out = formatReport(buildReport({ "aaaa1111.jsonl": FIXTURE_SESSION }));
		expect(out).toContain("sessions");
		expect(out).toContain("total tokens");
	});

	test("output contains Top 5 sections", async () => {
		const mod = await import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
		const buildReport = mod.buildReport as (files: Record<string, string>) => unknown;
		const formatReport = mod.formatReport as (data: unknown) => string;
		const out = formatReport(buildReport({ "aaaa1111.jsonl": FIXTURE_SESSION }));
		expect(out).toContain("Top 5 by tokens:");
		expect(out).toContain("Top 5 by duration:");
		expect(out).toContain("Per-tool call counts:");
	});

	test("output contains session id prefix (first 8 chars of filename stem)", async () => {
		const mod = await import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
		const buildReport = mod.buildReport as (files: Record<string, string>) => unknown;
		const formatReport = mod.formatReport as (data: unknown) => string;
		const out = formatReport(buildReport({ "aaaa1111.jsonl": FIXTURE_SESSION }));
		expect(out).toContain("aaaa1111");
	});
});
