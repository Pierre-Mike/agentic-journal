/**
 * Outer BDD acceptance gate — spec 055-add-pipeline-report-script
 *
 * RED: scripts/pipeline-report.ts does not exist yet. The import below will
 * throw "Cannot find module" at runtime, failing every test in this file.
 *
 * All four test groups pass only when all implementation slices are complete:
 *   Test 1 — JSONL parsing (slice 1)
 *   Test 2 — Aggregation math (slice 2)
 *   Test 3 — Output formatting, golden sections (slice 3)
 *   Test 4 — Empty-directory edge case + CLI (slice 4)
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// RED anchor: these exports do not exist yet — import fails at runtime.
import { aggregateSessions, formatReport, parseTraces } from "./pipeline-report.ts";

const SCRIPT = join(import.meta.dir, "pipeline-report.ts");

/** Write a set of named JSONL files into a fresh temp directory. */
function makeTempTraces(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "traces-"));
	for (const [name, content] of Object.entries(files)) {
		writeFileSync(join(dir, name), content);
	}
	return dir;
}

// ─── Test 1: JSONL parsing ────────────────────────────────────────────────────

describe("Test 1 — JSONL parsing", () => {
	test("extracts session count, token sums, tool call counts from trace events", async () => {
		const dir = makeTempTraces({
			"aaaa1111-bbbb-cccc-dddd-000000000001.jsonl":
				[
					JSON.stringify({ input_tokens: 100, output_tokens: 200 }),
					JSON.stringify({
						tool: "Read",
						started_at: "2026-01-01T00:00:00.000Z",
						duration_ms: 500,
					}),
					JSON.stringify({
						tool: "Read",
						started_at: "2026-01-01T00:00:02.000Z",
						duration_ms: 300,
					}),
					JSON.stringify({ irrelevant_field: "ignored" }),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);

		expect(sessions).toHaveLength(1);
		const [s] = sessions;
		expect(s?.sessionId).toBe("aaaa1111");
		expect(s?.inputTokens).toBe(100);
		expect(s?.outputTokens).toBe(200);
		expect(s?.toolCalls.get("Read")).toBe(2);
	});
});

// ─── Test 2: Aggregation math ─────────────────────────────────────────────────

describe("Test 2 — Aggregation math", () => {
	test("totalInputTokens and totalOutputTokens are summed across sessions", async () => {
		const dir = makeTempTraces({
			"s1.jsonl": JSON.stringify({ input_tokens: 100, output_tokens: 200 }) + "\n",
			"s2.jsonl": JSON.stringify({ input_tokens: 50, output_tokens: 75 }) + "\n",
		});

		const sessions = await parseTraces(dir);
		const agg = aggregateSessions(sessions);

		expect(agg.totalInputTokens).toBe(150);
		expect(agg.totalOutputTokens).toBe(275);
	});

	test("durationMs = file-span: max(started_at+duration_ms) − min(started_at)", async () => {
		const dir = makeTempTraces({
			"s1.jsonl":
				[
					JSON.stringify({ started_at: "2026-01-01T00:00:00.000Z", duration_ms: 1000 }),
					JSON.stringify({ started_at: "2026-01-01T00:00:05.000Z", duration_ms: 2000 }),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		// span = max(0+1000, 5000+2000) − min(0) = 7000 − 0 = 7000 ms
		expect(sessions[0]?.durationMs).toBe(7000);
	});
});

// ─── Test 3: Output formatting ────────────────────────────────────────────────

describe("Test 3 — Output formatting (golden string)", () => {
	test("formatReport output contains all four required sections", async () => {
		const dir = makeTempTraces({
			"s1.jsonl":
				[
					JSON.stringify({ input_tokens: 100, output_tokens: 200 }),
					JSON.stringify({
						tool: "Write",
						started_at: "2026-01-01T00:00:00.000Z",
						duration_ms: 500,
					}),
				].join("\n") + "\n",
		});

		const sessions = await parseTraces(dir);
		const agg = aggregateSessions(sessions);
		const out = formatReport(sessions, agg);

		// Section 1 — header line
		expect(out).toMatch(/^1 sessions \| \d+ total tokens \(in: \d+, out: \d+\) \|/m);
		// Section 2
		expect(out).toContain("Top 5 by tokens:");
		// Section 3
		expect(out).toContain("Top 5 by duration:");
		// Section 4
		expect(out).toContain("Tool calls:");
		expect(out).toContain("Write");
	});
});

// ─── Test 4: Empty directory edge case ───────────────────────────────────────

describe("Test 4 — Empty directory edge case", () => {
	test("empty traces dir → 'no trace data yet.' on stdout, exit 0", () => {
		const emptyDir = mkdtempSync(join(tmpdir(), "empty-traces-"));
		const proc = Bun.spawnSync(["bun", "run", SCRIPT], {
			env: { ...process.env, TRACES_DIR: emptyDir },
		});

		expect(proc.exitCode).toBe(0);
		expect(proc.stdout.toString()).toBe("no trace data yet.\n");
	});

	test("missing traces dir → 'no trace data yet.' on stdout, exit 0", () => {
		const proc = Bun.spawnSync(["bun", "run", SCRIPT], {
			env: { ...process.env, TRACES_DIR: "/tmp/xyzzy-does-not-exist-055" },
		});

		expect(proc.exitCode).toBe(0);
		expect(proc.stdout.toString()).toBe("no trace data yet.\n");
	});
});
