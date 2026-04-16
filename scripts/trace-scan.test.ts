/**
 * Colocated unit tests for the pure functions in scripts/trace-scan.ts.
 * Covered: parseSince, aggregate, topN. IO helpers (loadTraces, renderText, run)
 * are exercised by scripts/smoke-trace-scan.ts instead.
 */

import { describe, expect, test } from "bun:test";
import { aggregate, parseSince, type TraceLine, topN } from "./trace-scan.ts";

describe("parseSince", () => {
	const now = new Date("2026-04-16T12:00:00.000Z");

	test("undefined → null (no cutoff)", () => {
		expect(parseSince(undefined, now)).toBeNull();
	});

	test('"7d" → now minus 7 days', () => {
		const result = parseSince("7d", now);
		expect(result).toBeInstanceOf(Date);
		expect(result?.toISOString()).toBe("2026-04-09T12:00:00.000Z");
	});

	test('"1d" → now minus 1 day', () => {
		const result = parseSince("1d", now);
		expect(result?.toISOString()).toBe("2026-04-15T12:00:00.000Z");
	});

	test("ISO date → start-of-day UTC", () => {
		const result = parseSince("2026-04-14", now);
		expect(result?.toISOString()).toBe("2026-04-14T00:00:00.000Z");
	});

	test("unparseable input → null", () => {
		expect(parseSince("garbage", now)).toBeNull();
	});
});

describe("topN", () => {
	test("returns sorted descending, truncated to n", () => {
		const counts = new Map<string, number>([
			["a", 3],
			["b", 1],
			["c", 5],
			["d", 2],
		]);
		const result = topN(counts, 2);
		expect(result).toEqual([
			{ key: "c", count: 5 },
			{ key: "a", count: 3 },
		]);
	});

	test("n greater than size returns all", () => {
		const counts = new Map<string, number>([
			["x", 1],
			["y", 2],
		]);
		expect(topN(counts, 10)).toEqual([
			{ key: "y", count: 2 },
			{ key: "x", count: 1 },
		]);
	});

	test("empty map → empty array", () => {
		expect(topN(new Map<string, number>(), 5)).toEqual([]);
	});
});

describe("aggregate", () => {
	const baseA: TraceLine[] = [
		{
			ts: "2026-04-14T10:00:00.000Z",
			session_id: "A",
			event: "PreToolUse",
			agent_id: null,
			tool: "Write",
			file: "src/a.ts",
		},
		{
			ts: "2026-04-14T10:01:00.000Z",
			session_id: "A",
			event: "PostToolUse",
			agent_id: null,
			tool: "Write",
			file: "src/a.ts",
		},
		{
			ts: "2026-04-14T10:02:00.000Z",
			session_id: "A",
			event: "PreToolUse",
			agent_id: "sub-1",
			tool: "Read",
			file: "src/b.ts",
		},
	];
	const baseB: TraceLine[] = [
		{
			ts: "2026-04-15T08:00:00.000Z",
			session_id: "B",
			event: "PreToolUse",
			agent_id: null,
			tool: "Write",
			file: "src/c.ts",
		},
		{
			ts: "2026-04-15T08:01:00.000Z",
			session_id: "B",
			event: "Stop",
			agent_id: null,
		},
	];

	test("events_total + sessions_scanned", () => {
		const rep = aggregate([...baseA, ...baseB]);
		expect(rep.events_total).toBe(5);
		expect(rep.sessions_scanned).toBe(2);
	});

	test("tools_by_name counts PreToolUse only", () => {
		const rep = aggregate(baseA);
		const sess = rep.sessions[0];
		expect(sess?.tools_by_name.Write).toBe(1); // only the Pre
		expect(sess?.tools_by_name.Read).toBe(1);
	});

	test("files_touched_top per session sorted desc", () => {
		const rep = aggregate(baseA);
		const sess = rep.sessions[0];
		const top = sess?.files_touched_top[0];
		expect(top?.file).toBe("src/a.ts");
		expect(top?.count).toBe(2);
	});

	test("agent_ids_seen contains distinct non-null ids", () => {
		const rep = aggregate(baseA);
		const sess = rep.sessions[0];
		expect(sess?.agent_ids_seen).toEqual(["sub-1"]);
	});

	test("first_ts and last_ts match the range of session events", () => {
		const rep = aggregate(baseA);
		const sess = rep.sessions[0];
		expect(sess?.first_ts).toBe("2026-04-14T10:00:00.000Z");
		expect(sess?.last_ts).toBe("2026-04-14T10:02:00.000Z");
	});

	test("sessions sorted by events desc", () => {
		const rep = aggregate([...baseA, ...baseB]);
		expect(rep.sessions[0]?.session_id).toBe("A");
		expect(rep.sessions[1]?.session_id).toBe("B");
	});

	test("global files_touched_top aggregates across sessions", () => {
		const rep = aggregate([...baseA, ...baseB]);
		const top = rep.files_touched_top[0];
		expect(top?.file).toBe("src/a.ts");
		expect(top?.count).toBe(2);
	});

	test("empty input → zero counts, empty arrays", () => {
		const rep = aggregate([]);
		expect(rep.events_total).toBe(0);
		expect(rep.sessions_scanned).toBe(0);
		expect(rep.sessions).toEqual([]);
		expect(rep.files_touched_top).toEqual([]);
	});

	test("events missing tool/file are tolerated", () => {
		const rep = aggregate(baseB);
		const sess = rep.sessions[0];
		expect(sess?.events).toBe(2);
		expect(sess?.tools_by_name.Write).toBe(1);
		expect(sess?.files_touched_top[0]?.file).toBe("src/c.ts");
	});
});
