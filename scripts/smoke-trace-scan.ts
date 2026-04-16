/**
 * Gate for spec 005-trace-scan.
 *
 * Real-assertion smoke: builds a tmpdir with known JSONL trace fixtures, runs
 * loadTraces + aggregate, asserts event/session/tool/file counts, and checks
 * --session filtering. Pre-impl this exits 1 (trace-scan.ts missing); post-impl 0.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let failed = 0;

function pass(name: string): void {
	console.log(`  \u2713 ${name}`);
}

function fail(name: string, detail?: string): void {
	console.log(`  \u2716 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
	failed++;
}

function assertTrue(cond: boolean, name: string, detail?: string): void {
	if (cond) pass(name);
	else fail(name, detail);
}

interface MinimalTraceLine {
	ts: string;
	session_id: string;
	event: string;
	agent_id: string | null;
	tool?: string;
	file?: string | null;
}

function writeJsonl(path: string, lines: MinimalTraceLine[]): void {
	writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`);
}

async function test1_aggregateBasics(): Promise<void> {
	console.log("test 1: aggregate counts events/sessions/tools/files over a fixture dir");
	const dir = mkdtempSync(join(tmpdir(), "trace-scan-"));
	try {
		writeJsonl(join(dir, "sess-A.jsonl"), [
			{
				ts: "2026-04-14T10:00:00.000Z",
				session_id: "sess-A",
				event: "PreToolUse",
				agent_id: null,
				tool: "Write",
				file: "src/a.ts",
			},
			{
				ts: "2026-04-14T10:01:00.000Z",
				session_id: "sess-A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Write",
				file: "src/a.ts",
			},
			{
				ts: "2026-04-14T10:02:00.000Z",
				session_id: "sess-A",
				event: "PreToolUse",
				agent_id: null,
				tool: "Edit",
				file: "src/a.ts",
			},
			{
				ts: "2026-04-14T10:03:00.000Z",
				session_id: "sess-A",
				event: "PreToolUse",
				agent_id: "sub-1",
				tool: "Read",
				file: "src/b.ts",
			},
		]);
		writeJsonl(join(dir, "sess-B.jsonl"), [
			{
				ts: "2026-04-15T08:00:00.000Z",
				session_id: "sess-B",
				event: "PreToolUse",
				agent_id: null,
				tool: "Write",
				file: "src/c.ts",
			},
			{
				ts: "2026-04-15T08:01:00.000Z",
				session_id: "sess-B",
				event: "Stop",
				agent_id: null,
			},
		]);
		// Malformed line should be skipped silently
		writeFileSync(join(dir, "sess-C.jsonl"), "{this is not json\n");

		const mod = await import(join(process.cwd(), "scripts/trace-scan.ts"));
		if (typeof mod.aggregate !== "function" || typeof mod.loadTraces !== "function") {
			fail("scripts/trace-scan.ts exports aggregate + loadTraces", "missing export(s)");
			return;
		}
		const events = mod.loadTraces(dir, null);
		const report = mod.aggregate(events);

		assertTrue(report.events_total === 6, "events_total === 6", `got ${report.events_total}`);
		assertTrue(
			report.sessions_scanned === 2,
			"sessions_scanned === 2 (malformed file yields 0 events, not counted)",
			`got ${report.sessions_scanned}`,
		);
		const sessA = report.sessions.find((s: { session_id: string }) => s.session_id === "sess-A");
		assertTrue(sessA !== undefined, "sess-A present in report");
		if (sessA) {
			assertTrue(sessA.events === 4, "sess-A events === 4", `got ${sessA.events}`);
			assertTrue(
				sessA.tools_by_name.Write === 1,
				"sess-A tools_by_name.Write === 1 (PreToolUse only)",
				`got ${sessA.tools_by_name.Write}`,
			);
			assertTrue(
				sessA.tools_by_name.Edit === 1,
				"sess-A tools_by_name.Edit === 1",
				`got ${sessA.tools_by_name.Edit}`,
			);
			assertTrue(
				sessA.tools_by_name.Read === 1,
				"sess-A tools_by_name.Read === 1",
				`got ${sessA.tools_by_name.Read}`,
			);
			const topFile = sessA.files_touched_top[0];
			assertTrue(
				topFile?.file === "src/a.ts" && topFile?.count === 3,
				"sess-A top file is src/a.ts count 3 (Pre Write, Post Write, Pre Edit)",
				`got ${JSON.stringify(topFile)}`,
			);
			assertTrue(
				sessA.agent_ids_seen.includes("sub-1"),
				"sess-A agent_ids_seen includes sub-1",
				`got ${JSON.stringify(sessA.agent_ids_seen)}`,
			);
		}
		const globalTop = report.files_touched_top[0];
		assertTrue(
			globalTop?.file === "src/a.ts" && globalTop?.count === 3,
			"global top file is src/a.ts count 3",
			`got ${JSON.stringify(globalTop)}`,
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function test2_sessionFilter(): Promise<void> {
	console.log("\ntest 2: --session filter restricts to one file");
	const dir = mkdtempSync(join(tmpdir(), "trace-scan-"));
	try {
		writeJsonl(join(dir, "sess-X.jsonl"), [
			{
				ts: "2026-04-14T10:00:00.000Z",
				session_id: "sess-X",
				event: "PreToolUse",
				agent_id: null,
				tool: "Write",
				file: "x.ts",
			},
		]);
		writeJsonl(join(dir, "sess-Y.jsonl"), [
			{
				ts: "2026-04-14T10:00:00.000Z",
				session_id: "sess-Y",
				event: "PreToolUse",
				agent_id: null,
				tool: "Write",
				file: "y.ts",
			},
		]);
		const mod = await import(join(process.cwd(), "scripts/trace-scan.ts"));
		if (typeof mod.loadTraces !== "function" || typeof mod.aggregate !== "function") {
			fail("scripts/trace-scan.ts exports loadTraces + aggregate", "missing export(s)");
			return;
		}
		const onlyX = mod.aggregate(mod.loadTraces(dir, "sess-X"));
		assertTrue(
			onlyX.sessions_scanned === 1,
			"sessions_scanned === 1 under --session sess-X",
			`got ${onlyX.sessions_scanned}`,
		);
		assertTrue(
			onlyX.sessions[0]?.session_id === "sess-X",
			"only sess-X appears",
			`got ${onlyX.sessions[0]?.session_id}`,
		);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

async function test3_parseSinceAndTopN(): Promise<void> {
	console.log("\ntest 3: parseSince + topN exports present and behave");
	const mod = await import(join(process.cwd(), "scripts/trace-scan.ts"));
	if (typeof mod.parseSince !== "function" || typeof mod.topN !== "function") {
		fail("scripts/trace-scan.ts exports parseSince + topN", "missing export(s)");
		return;
	}
	const now = new Date("2026-04-16T12:00:00.000Z");
	const d7 = mod.parseSince("7d", now);
	assertTrue(
		d7 instanceof Date && d7.toISOString() === "2026-04-09T12:00:00.000Z",
		'parseSince("7d", now) === now − 7d',
		`got ${d7 instanceof Date ? d7.toISOString() : String(d7)}`,
	);
	const iso = mod.parseSince("2026-04-14", now);
	assertTrue(
		iso instanceof Date && iso.toISOString() === "2026-04-14T00:00:00.000Z",
		'parseSince("2026-04-14", now) === 2026-04-14T00:00:00Z',
		`got ${iso instanceof Date ? iso.toISOString() : String(iso)}`,
	);
	const none = mod.parseSince(undefined, now);
	assertTrue(none === null, "parseSince(undefined, now) === null", `got ${none}`);

	const counts = new Map<string, number>([
		["a", 3],
		["b", 1],
		["c", 5],
		["d", 2],
	]);
	const top2 = mod.topN(counts, 2);
	assertTrue(
		Array.isArray(top2) && top2.length === 2 && top2[0]?.key === "c" && top2[1]?.key === "a",
		"topN(counts, 2) → [c, a]",
		`got ${JSON.stringify(top2)}`,
	);
}

async function main(): Promise<void> {
	try {
		await test1_aggregateBasics();
	} catch (e) {
		fail("test 1 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test2_sessionFilter();
	} catch (e) {
		fail("test 2 threw", e instanceof Error ? e.message : String(e));
	}
	try {
		await test3_parseSinceAndTopN();
	} catch (e) {
		fail("test 3 threw", e instanceof Error ? e.message : String(e));
	}

	if (failed > 0) {
		console.log(`\n\u2716 ${failed} assertion(s) failed`);
		process.exit(1);
	}
	console.log("\n\u2713 all green");
}

await main();
