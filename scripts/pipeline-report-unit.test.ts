/**
 * Unit-level outer gate — spec 055-add-pipeline-report-script
 *
 * RED: scripts/pipeline-report.ts does not exist yet. The import below throws
 * "Cannot find module" at runtime, failing every test in this file.
 *
 * Tests 1 & 2 from alignment.md in pure function form (no subprocess):
 *   Test 1 — parseTraces correctly extracts session data from JSONL
 *   Test 2 — aggregateSessions correctly sums tokens and computes durations
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// RED anchor: these exports do not exist yet — import fails at runtime.
import { aggregateSessions, parseTraces } from "./pipeline-report.ts";

function makeTempTraces(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "traces-"));
	for (const [name, content] of Object.entries(files)) {
		writeFileSync(join(dir, name), content);
	}
	return dir;
}

// ─── Test 1: JSONL parsing ────────────────────────────────────────────────────

describe("parseTraces — JSONL parsing", () => {
	test("returns one SessionStats per .jsonl file", async () => {
		const dir = makeTempTraces({
			"aaaa1111-bbbb-cccc-dddd-000000000001.jsonl":
				[JSON.stringify({ input_tokens: 100, output_tokens: 200 })].join("\n") + "\n",
			"bbbb2222-cccc-dddd-eeee-000000000002.jsonl":
				[JSON.stringify({ input_tokens: 50, output_tokens: 75 })].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		expect(sessions).toHaveLength(2);
	});

	test("sessionId is the first 8 chars of the filename stem", async () => {
		const dir = makeTempTraces({
			"aaaa1111-bbbb-cccc-dddd-000000000001.jsonl":
				JSON.stringify({ input_tokens: 1, output_tokens: 1 }) + "\n",
		});

		const sessions = await parseTraces(dir);
		expect(sessions[0]?.sessionId).toBe("aaaa1111");
	});

	test("token fields summed correctly within a single session file", async () => {
		const dir = makeTempTraces({
			"s1.jsonl":
				[
					JSON.stringify({ input_tokens: 100, output_tokens: 200 }),
					JSON.stringify({ input_tokens: 50, output_tokens: 75 }),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		expect(sessions[0]?.inputTokens).toBe(150);
		expect(sessions[0]?.outputTokens).toBe(275);
	});

	test("tool call counts are accumulated per tool name", async () => {
		const dir = makeTempTraces({
			"s1.jsonl":
				[
					JSON.stringify({ tool: "Read" }),
					JSON.stringify({ tool: "Read" }),
					JSON.stringify({ tool: "Write" }),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		expect(sessions[0]?.toolCalls.get("Read")).toBe(2);
		expect(sessions[0]?.toolCalls.get("Write")).toBe(1);
	});

	test("non-relevant event fields are silently ignored", async () => {
		const dir = makeTempTraces({
			"s1.jsonl":
				[
					JSON.stringify({ irrelevant: "data", another_field: 42 }),
					JSON.stringify({ input_tokens: 10, output_tokens: 20 }),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		expect(sessions[0]?.inputTokens).toBe(10);
		expect(sessions[0]?.outputTokens).toBe(20);
	});
});

// ─── Test 2: Aggregation math ─────────────────────────────────────────────────

describe("aggregateSessions — aggregation math", () => {
	test("totalInputTokens and totalOutputTokens summed across all sessions", async () => {
		const dir = makeTempTraces({
			"s1.jsonl": JSON.stringify({ input_tokens: 100, output_tokens: 200 }) + "\n",
			"s2.jsonl": JSON.stringify({ input_tokens: 50, output_tokens: 75 }) + "\n",
		});

		const sessions = await parseTraces(dir);
		const agg = aggregateSessions(sessions);

		expect(agg.totalInputTokens).toBe(150);
		expect(agg.totalOutputTokens).toBe(275);
	});

	test("durationMs = max(started_at+duration_ms) − min(started_at) across events", async () => {
		const dir = makeTempTraces({
			"s1.jsonl":
				[
					JSON.stringify({ started_at: "2026-01-01T00:00:00.000Z", duration_ms: 1000 }),
					JSON.stringify({ started_at: "2026-01-01T00:00:05.000Z", duration_ms: 2000 }),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		// max end = 5000 + 2000 = 7000ms; min start = 0ms; span = 7000ms
		expect(sessions[0]?.durationMs).toBe(7000);
	});

	test("session with no timestamp events has durationMs = 0", async () => {
		const dir = makeTempTraces({
			"s1.jsonl": JSON.stringify({ input_tokens: 10, output_tokens: 20 }) + "\n",
		});

		const sessions = await parseTraces(dir);
		expect(sessions[0]?.durationMs).toBe(0);
	});

	test("totalSessions reflects the number of .jsonl files", async () => {
		const dir = makeTempTraces({
			"s1.jsonl": JSON.stringify({ input_tokens: 1, output_tokens: 1 }) + "\n",
			"s2.jsonl": JSON.stringify({ input_tokens: 2, output_tokens: 2 }) + "\n",
			"s3.jsonl": JSON.stringify({ input_tokens: 3, output_tokens: 3 }) + "\n",
		});

		const sessions = await parseTraces(dir);
		const agg = aggregateSessions(sessions);
		expect(agg.totalSessions).toBe(3);
	});
});
