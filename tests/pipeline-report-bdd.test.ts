/**
 * BDD outer gate for spec 054: pipeline:report script.
 *
 * RED at scaffold: scripts/pipeline-report.ts does not exist yet —
 * dynamic imports and file-existence checks below will all fail.
 *
 * GREEN after both slices complete:
 *   slice 1: formatReport pure function + scripts/pipeline-report.ts + unit tests
 *   slice 2: main() + --traces-dir flag + package.json pipeline:report registration
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
	function readPkg(): { scripts?: Record<string, string> } {
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
// Exported API
// ---------------------------------------------------------------------------

describe("scripts/pipeline-report.ts: exported API", () => {
	async function loadModule(): Promise<Record<string, unknown>> {
		return import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
	}

	test("exports formatReport function", async () => {
		const mod = await loadModule();
		expect(typeof mod.formatReport).toBe("function");
	});
});

// ---------------------------------------------------------------------------
// Contract: formatReport output shape (via dynamic import)
// ---------------------------------------------------------------------------

interface TraceScanReportFixture {
	since: string | null;
	sessions_scanned: number;
	events_total: number;
	sessions: Array<{
		session_id: string;
		events: number;
		first_ts: string;
		last_ts: string;
		tools_by_name: Record<string, number>;
		files_touched_top: Array<{ file: string; count: number }>;
		agent_ids_seen: string[];
	}>;
	files_touched_top: Array<{ file: string; count: number }>;
	loops: Array<{
		session_id: string;
		tool: string;
		file: string;
		count: number;
		first_ts: string;
		last_ts: string;
	}>;
	drift: Array<{ session_id: string; tool: string; file: string; ts: string }>;
	retries: Array<{ session_id: string; count: number; first_ts: string; last_ts: string }>;
	blocks: Array<{
		session_id: string;
		reason: string;
		file: string;
		count: number;
		first_ts: string;
	}>;
	hot_files: Array<{
		session_id: string;
		file: string;
		count: number;
		first_ts: string;
		last_ts: string;
	}>;
}

function makeZeroReport(): TraceScanReportFixture {
	return {
		since: null,
		sessions_scanned: 0,
		events_total: 0,
		sessions: [],
		files_touched_top: [],
		loops: [],
		drift: [],
		retries: [],
		blocks: [],
		hot_files: [],
	};
}

describe("formatReport: output shape", () => {
	async function formatReport(report: TraceScanReportFixture): Promise<string> {
		const mod = await import(join(REPO_ROOT, "scripts/pipeline-report.ts"));
		return (mod.formatReport as (r: TraceScanReportFixture) => string)(report);
	}

	test("zero-state: sessions line matches format", async () => {
		const out = await formatReport(makeZeroReport());
		expect(out).toMatch(/^sessions: 0 {2}events: 0/m);
	});

	test("zero-state: anomalies line present with all zeros", async () => {
		const out = await formatReport(makeZeroReport());
		expect(out).toMatch(/anomalies: loops=0 drift=0 retries=0 blocks=0/);
	});

	test("zero-state: top tools line present", async () => {
		const out = await formatReport(makeZeroReport());
		expect(out).toMatch(/^top tools:/m);
	});

	test("zero-state: top files line present", async () => {
		const out = await formatReport(makeZeroReport());
		expect(out).toMatch(/^top files:/m);
	});

	test("non-zero sessions: counts reflected in sessions line", async () => {
		const report: TraceScanReportFixture = {
			...makeZeroReport(),
			sessions_scanned: 2,
			events_total: 42,
			sessions: [
				{
					session_id: "s1",
					events: 30,
					first_ts: "2026-04-30T00:00:00Z",
					last_ts: "2026-04-30T01:00:00Z",
					tools_by_name: { Write: 10, Read: 5 },
					files_touched_top: [],
					agent_ids_seen: [],
				},
				{
					session_id: "s2",
					events: 12,
					first_ts: "2026-04-30T01:00:00Z",
					last_ts: "2026-04-30T02:00:00Z",
					tools_by_name: { Bash: 6 },
					files_touched_top: [],
					agent_ids_seen: [],
				},
			],
		};
		const out = await formatReport(report);
		expect(out).toMatch(/^sessions: 2 {2}events: 42/m);
	});

	test("top tools derived from sessions tools_by_name", async () => {
		const report: TraceScanReportFixture = {
			...makeZeroReport(),
			sessions_scanned: 1,
			events_total: 15,
			sessions: [
				{
					session_id: "s1",
					events: 15,
					first_ts: "2026-04-30T00:00:00Z",
					last_ts: "2026-04-30T01:00:00Z",
					tools_by_name: { Write: 10, Read: 5 },
					files_touched_top: [],
					agent_ids_seen: [],
				},
			],
		};
		const out = await formatReport(report);
		expect(out).toMatch(/top tools:.*Write/);
	});

	test("top files derived from files_touched_top", async () => {
		const report: TraceScanReportFixture = {
			...makeZeroReport(),
			files_touched_top: [
				{ file: "scripts/foo.ts", count: 7 },
				{ file: "scripts/bar.ts", count: 3 },
			],
		};
		const out = await formatReport(report);
		expect(out).toMatch(/top files:.*scripts\/foo\.ts/);
	});

	test("anomalies: non-zero loop count reflected", async () => {
		const report: TraceScanReportFixture = {
			...makeZeroReport(),
			loops: [
				{
					session_id: "s1",
					tool: "Write",
					file: "foo.ts",
					count: 5,
					first_ts: "2026-04-30T00:00:00Z",
					last_ts: "2026-04-30T01:00:00Z",
				},
			],
		};
		const out = await formatReport(report);
		expect(out).toMatch(/anomalies: loops=1 drift=0 retries=0 blocks=0/);
	});

	test("anomalies: mixed non-zero counts reflected", async () => {
		const report: TraceScanReportFixture = {
			...makeZeroReport(),
			loops: [
				{
					session_id: "s1",
					tool: "Write",
					file: "foo.ts",
					count: 3,
					first_ts: "",
					last_ts: "",
				},
			],
			retries: [{ session_id: "s1", count: 4, first_ts: "", last_ts: "" }],
			blocks: [{ session_id: "s1", reason: "perm", file: "foo.ts", count: 2, first_ts: "" }],
		};
		const out = await formatReport(report);
		expect(out).toMatch(/anomalies: loops=1 drift=0 retries=1 blocks=1/);
	});
});

// ---------------------------------------------------------------------------
// Subprocess: exits 0 and produces non-empty output
// ---------------------------------------------------------------------------

describe("bun scripts/pipeline-report.ts: subprocess", () => {
	test("exits 0 with empty traces dir", async () => {
		const tmpDir = join(tmpdir(), `pipeline-report-bdd-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		const proc = Bun.spawn(
			["bun", join(REPO_ROOT, "scripts/pipeline-report.ts"), "--traces-dir", tmpDir],
			{ cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
		);
		const code = await proc.exited;
		expect(code).toBe(0);
	});

	test("stdout is non-empty on empty traces dir", async () => {
		const tmpDir = join(tmpdir(), `pipeline-report-bdd-nonempty-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		const proc = Bun.spawn(
			["bun", join(REPO_ROOT, "scripts/pipeline-report.ts"), "--traces-dir", tmpDir],
			{ cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
		);
		await proc.exited;
		const out = await new Response(proc.stdout).text();
		expect(out.trim().length).toBeGreaterThan(0);
	});

	test("stdout contains sessions line with correct format", async () => {
		const tmpDir = join(tmpdir(), `pipeline-report-bdd-sessions-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		const proc = Bun.spawn(
			["bun", join(REPO_ROOT, "scripts/pipeline-report.ts"), "--traces-dir", tmpDir],
			{ cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
		);
		await proc.exited;
		const out = await new Response(proc.stdout).text();
		expect(out).toMatch(/sessions: \d+ {2}events: \d+/);
	});

	test("stdout contains anomalies line with correct format", async () => {
		const tmpDir = join(tmpdir(), `pipeline-report-bdd-anomalies-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		const proc = Bun.spawn(
			["bun", join(REPO_ROOT, "scripts/pipeline-report.ts"), "--traces-dir", tmpDir],
			{ cwd: REPO_ROOT, stdout: "pipe", stderr: "pipe" },
		);
		await proc.exited;
		const out = await new Response(proc.stdout).text();
		expect(out).toMatch(/anomalies: loops=\d+ drift=\d+ retries=\d+ blocks=\d+/);
	});
});
