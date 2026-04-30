/**
 * BDD outer-gate for spec 055: pipeline:report script.
 *
 * RED at scaffold: scripts/pipeline-report.ts does not exist yet — the static
 * import below will throw a module-not-found error, failing all tests.
 *
 * GREEN after both slices complete:
 *   slice 1: parseTraceContent + buildReport + formatReport + Zod schemas
 *   slice 2: main() entry point + package.json pipeline:report registration
 *
 * All fixtures are inline JSONL strings — no disk I/O.
 */

import { describe, expect, test } from "bun:test";
import { buildReport, formatReport, parseTraceContent } from "./pipeline-report.ts";

// ---------------------------------------------------------------------------
// Inline JSONL fixtures
// ---------------------------------------------------------------------------

const TOKEN_USAGE_A =
	'{"type":"token_usage","session_id":"aaaa1111","input_tokens":10,"output_tokens":5,"started_at":"2026-04-30T10:00:00.000Z","duration_ms":2000}';
const TOOL_USE_BASH = '{"type":"tool_use","session_id":"aaaa1111","tool":"Bash"}';
const UNKNOWN_EVENT = '{"type":"future_event","session_id":"aaaa1111","payload":"ignored"}';

const TOKEN_USAGE_B =
	'{"type":"token_usage","session_id":"bbbb2222","input_tokens":20,"output_tokens":10,"started_at":"2026-04-30T11:00:00.000Z","duration_ms":3000}';
const TOOL_USE_READ = '{"type":"tool_use","session_id":"bbbb2222","tool":"Read"}';

const FILE_A = [TOKEN_USAGE_A, TOOL_USE_BASH].join("\n");
const FILE_B = [TOKEN_USAGE_B, TOOL_USE_READ, TOOL_USE_READ].join("\n");

// ---------------------------------------------------------------------------
// parseTraceContent — JSONL parsing
// ---------------------------------------------------------------------------

describe("parseTraceContent", () => {
	test("parses a single token_usage line", () => {
		const events = parseTraceContent(TOKEN_USAGE_A);
		expect(events).toHaveLength(1);
		expect(events[0]?.type).toBe("token_usage");
	});

	test("parses a single tool_use line", () => {
		const events = parseTraceContent(TOOL_USE_BASH);
		expect(events).toHaveLength(1);
		expect(events[0]?.type).toBe("tool_use");
	});

	test("silently drops unknown event types (forward-compatible)", () => {
		const content = [TOKEN_USAGE_A, TOOL_USE_BASH, UNKNOWN_EVENT].join("\n");
		const events = parseTraceContent(content);
		const types = events.map((e) => e.type);
		expect(types).not.toContain("future_event");
		expect(types.filter((t) => t === "token_usage")).toHaveLength(1);
		expect(types.filter((t) => t === "tool_use")).toHaveLength(1);
	});

	test("empty string returns empty array", () => {
		expect(parseTraceContent("")).toEqual([]);
	});

	test("blank lines are skipped without error", () => {
		const content = "\n\n" + TOKEN_USAGE_A + "\n\n";
		expect(parseTraceContent(content)).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// buildReport — aggregation math
// ---------------------------------------------------------------------------

describe("buildReport — token aggregation", () => {
	test("sums input_tokens across sessions", () => {
		const report = buildReport({ "aaaa1111.jsonl": FILE_A, "bbbb2222.jsonl": FILE_B });
		expect(report.totalInputTokens).toBe(30); // 10 + 20
	});

	test("sums output_tokens across sessions", () => {
		const report = buildReport({ "aaaa1111.jsonl": FILE_A, "bbbb2222.jsonl": FILE_B });
		expect(report.totalOutputTokens).toBe(15); // 5 + 10
	});

	test("sums duration_ms across sessions", () => {
		const report = buildReport({ "aaaa1111.jsonl": FILE_A, "bbbb2222.jsonl": FILE_B });
		expect(report.totalDurationMs).toBe(5000); // 2000 + 3000
	});

	test("counts sessions correctly", () => {
		const report = buildReport({ "aaaa1111.jsonl": FILE_A, "bbbb2222.jsonl": FILE_B });
		expect(report.sessionCount).toBe(2);
	});

	test("empty files map → zero across the board", () => {
		const report = buildReport({});
		expect(report.sessionCount).toBe(0);
		expect(report.totalInputTokens).toBe(0);
		expect(report.totalOutputTokens).toBe(0);
		expect(report.totalDurationMs).toBe(0);
	});

	test("unknown events do not inflate token totals", () => {
		const content = FILE_A + "\n" + UNKNOWN_EVENT;
		const report = buildReport({ "aaaa1111.jsonl": content });
		expect(report.totalInputTokens).toBe(10);
		expect(report.totalOutputTokens).toBe(5);
	});
});

describe("buildReport — tool counts", () => {
	test("counts per-tool calls summed across sessions", () => {
		const report = buildReport({ "aaaa1111.jsonl": FILE_A, "bbbb2222.jsonl": FILE_B });
		expect(report.toolCounts["Bash"]).toBe(1);
		expect(report.toolCounts["Read"]).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// formatReport — output format
// ---------------------------------------------------------------------------

describe("formatReport", () => {
	test("zero sessions → 'no trace data yet.'", () => {
		expect(formatReport(buildReport({}))).toBe("no trace data yet.");
	});

	test("golden-string assertion on two-session fixture", () => {
		// Session aaaa1111: 15 tokens (10+5), 2s
		// Session bbbb2222: 30 tokens (20+10), 3s
		// Total: 2 sessions, 45 tokens (in:30, out:15), 5s wall-clock
		// Top-5 by tokens: bbbb2222 first (30), aaaa1111 second (15)
		// Top-5 by duration: bbbb2222 first (3s), aaaa1111 second (2s)
		// Per-tool: Read (2), Bash (1)
		const report = buildReport({ "aaaa1111.jsonl": FILE_A, "bbbb2222.jsonl": FILE_B });
		const expected = [
			"2 sessions | 45 total tokens (in: 30, out: 15) | 5s total wall-clock",
			"",
			"Top 5 by tokens:",
			"  bbbb2222  30  3s",
			"  aaaa1111  15  2s",
			"",
			"Top 5 by duration:",
			"  bbbb2222  30  3s",
			"  aaaa1111  15  2s",
			"",
			"Per-tool call counts:",
			"  Read  2",
			"  Bash  1",
		].join("\n");
		expect(formatReport(report)).toBe(expected);
	});
});
