/**
 * Unit tests for spec 054: pipeline:report formatReport pure function.
 *
 * RED at scaffold: scripts/pipeline-report.ts does not exist yet — the import
 * below will throw a module-not-found error, failing all tests.
 *
 * GREEN after slice 1 implements formatReport.
 *
 * Tests formatReport directly with fixture TraceScanReport objects —
 * no subprocess calls, no I/O.
 */

import { describe, expect, test } from "bun:test";
import type { TraceScanReport } from "./agentic/trace-scan.ts";
import { formatReport } from "./pipeline-report.ts";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeZeroReport(): TraceScanReport {
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

// ---------------------------------------------------------------------------
// Zero-state output
// ---------------------------------------------------------------------------

describe("formatReport: zero state", () => {
	test("sessions line: sessions: 0  events: 0", () => {
		const out = formatReport(makeZeroReport());
		expect(out).toMatch(/^sessions: 0 {2}events: 0/m);
	});

	test("top tools line present (empty)", () => {
		const out = formatReport(makeZeroReport());
		expect(out).toMatch(/^top tools:/m);
	});

	test("top files line present (empty)", () => {
		const out = formatReport(makeZeroReport());
		expect(out).toMatch(/^top files:/m);
	});

	test("anomalies line: all zeros", () => {
		const out = formatReport(makeZeroReport());
		expect(out).toMatch(/^anomalies: loops=0 drift=0 retries=0 blocks=0$/m);
	});

	test("output has exactly 4 non-empty lines", () => {
		const out = formatReport(makeZeroReport());
		const lines = out.split("\n").filter((l) => l.trim().length > 0);
		expect(lines.length).toBe(4);
	});
});

// ---------------------------------------------------------------------------
// Single-session output
// ---------------------------------------------------------------------------

describe("formatReport: single session", () => {
	function makeSingleSessionReport(): TraceScanReport {
		return {
			...makeZeroReport(),
			sessions_scanned: 1,
			events_total: 20,
			sessions: [
				{
					session_id: "abc123",
					events: 20,
					first_ts: "2026-04-30T00:00:00Z",
					last_ts: "2026-04-30T01:00:00Z",
					tools_by_name: { Write: 8, Read: 7, Bash: 5 },
					files_touched_top: [],
					agent_ids_seen: [],
				},
			],
		};
	}

	test("sessions line reflects count and total events", () => {
		const out = formatReport(makeSingleSessionReport());
		expect(out).toMatch(/^sessions: 1 {2}events: 20/m);
	});

	test("top tools includes Write with count", () => {
		const out = formatReport(makeSingleSessionReport());
		expect(out).toMatch(/top tools:.*Write\(8\)/);
	});

	test("top tools sorted descending by count: Write before Read before Bash", () => {
		const out = formatReport(makeSingleSessionReport());
		const toolsLine = out.split("\n").find((l) => l.startsWith("top tools:"));
		expect(toolsLine).toBeDefined();
		const writeIdx = toolsLine?.indexOf("Write") ?? -1;
		const readIdx = toolsLine?.indexOf("Read") ?? -1;
		const bashIdx = toolsLine?.indexOf("Bash") ?? -1;
		expect(writeIdx).toBeLessThan(readIdx);
		expect(readIdx).toBeLessThan(bashIdx);
	});
});

// ---------------------------------------------------------------------------
// Multi-session output with files
// ---------------------------------------------------------------------------

describe("formatReport: multi-session with files", () => {
	function makeMultiReport(): TraceScanReport {
		return {
			...makeZeroReport(),
			sessions_scanned: 2,
			events_total: 35,
			sessions: [
				{
					session_id: "s1",
					events: 22,
					first_ts: "2026-04-30T00:00:00Z",
					last_ts: "2026-04-30T01:00:00Z",
					tools_by_name: { Write: 10, Read: 6 },
					files_touched_top: [],
					agent_ids_seen: [],
				},
				{
					session_id: "s2",
					events: 13,
					first_ts: "2026-04-30T01:00:00Z",
					last_ts: "2026-04-30T02:00:00Z",
					tools_by_name: { Bash: 8, Read: 3 },
					files_touched_top: [],
					agent_ids_seen: [],
				},
			],
			files_touched_top: [
				{ file: "scripts/foo.ts", count: 12 },
				{ file: "scripts/bar.ts", count: 5 },
			],
		};
	}

	test("sessions line: sessions: 2  events: 35", () => {
		const out = formatReport(makeMultiReport());
		expect(out).toMatch(/^sessions: 2 {2}events: 35/m);
	});

	test("top tools merges across sessions: Write(10) appears", () => {
		const out = formatReport(makeMultiReport());
		expect(out).toMatch(/Write\(10\)/);
	});

	test("top tools merges across sessions: Read total is 9", () => {
		const out = formatReport(makeMultiReport());
		expect(out).toMatch(/Read\(9\)/);
	});

	test("top files includes scripts/foo.ts with count", () => {
		const out = formatReport(makeMultiReport());
		expect(out).toMatch(/top files:.*scripts\/foo\.ts\(12\)/);
	});

	test("top files sorted descending by count: foo before bar", () => {
		const out = formatReport(makeMultiReport());
		const filesLine = out.split("\n").find((l) => l.startsWith("top files:"));
		expect(filesLine).toBeDefined();
		const fooIdx = filesLine?.indexOf("foo") ?? -1;
		const barIdx = filesLine?.indexOf("bar") ?? -1;
		expect(fooIdx).toBeLessThan(barIdx);
	});
});

// ---------------------------------------------------------------------------
// Anomaly counts
// ---------------------------------------------------------------------------

describe("formatReport: anomalies", () => {
	test("loops count reflects loops array length", () => {
		const report: TraceScanReport = {
			...makeZeroReport(),
			loops: [
				{
					session_id: "s1",
					tool: "Write",
					file: "foo.ts",
					count: 5,
					first_ts: "",
					last_ts: "",
				},
				{
					session_id: "s2",
					tool: "Edit",
					file: "bar.ts",
					count: 3,
					first_ts: "",
					last_ts: "",
				},
			],
		};
		const out = formatReport(report);
		expect(out).toMatch(/anomalies: loops=2 drift=0 retries=0 blocks=0/);
	});

	test("drift count reflects drift array length", () => {
		const report: TraceScanReport = {
			...makeZeroReport(),
			drift: [{ session_id: "s1", tool: "Write", file: "outside.ts", ts: "" }],
		};
		const out = formatReport(report);
		expect(out).toMatch(/anomalies: loops=0 drift=1 retries=0 blocks=0/);
	});

	test("retries count reflects retries array length", () => {
		const report: TraceScanReport = {
			...makeZeroReport(),
			retries: [{ session_id: "s1", count: 4, first_ts: "", last_ts: "" }],
		};
		const out = formatReport(report);
		expect(out).toMatch(/anomalies: loops=0 drift=0 retries=1 blocks=0/);
	});

	test("blocks count reflects blocks array length", () => {
		const report: TraceScanReport = {
			...makeZeroReport(),
			blocks: [
				{
					session_id: "s1",
					reason: "permission denied",
					file: "foo.ts",
					count: 2,
					first_ts: "",
				},
			],
		};
		const out = formatReport(report);
		expect(out).toMatch(/anomalies: loops=0 drift=0 retries=0 blocks=1/);
	});

	test("all anomaly types non-zero", () => {
		const report: TraceScanReport = {
			...makeZeroReport(),
			loops: [
				{ session_id: "s1", tool: "Write", file: "a.ts", count: 3, first_ts: "", last_ts: "" },
			],
			drift: [{ session_id: "s1", tool: "Write", file: "b.ts", ts: "" }],
			retries: [{ session_id: "s1", count: 4, first_ts: "", last_ts: "" }],
			blocks: [
				{ session_id: "s1", reason: "perm", file: "c.ts", count: 1, first_ts: "" },
				{ session_id: "s2", reason: "perm", file: "d.ts", count: 1, first_ts: "" },
			],
		};
		const out = formatReport(report);
		expect(out).toMatch(/anomalies: loops=1 drift=1 retries=1 blocks=2/);
	});
});
