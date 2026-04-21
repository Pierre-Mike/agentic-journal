/**
 * Colocated unit tests for the pure functions in scripts/trace-scan.ts.
 * Covered: parseSince, aggregate, topN, detectLoops, detectDrift,
 * detectRetryStorm, backward-compat parsing. IO helpers (loadTraces, renderText,
 * run) are exercised by scripts/smoke-trace-scan.ts instead.
 */

import { describe, expect, test } from "bun:test";
import {
	aggregate,
	detectDrift,
	detectLoops,
	detectRetryStorm,
	parseBlocked,
	parseSince,
	renderBlocks,
	renderText,
	type TraceLine,
	topN,
} from "./trace-scan.ts";

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
		const rep = aggregate({ events: [...baseA, ...baseB], repoRoot: "/tmp/fakerepo" });
		expect(rep.events_total).toBe(5);
		expect(rep.sessions_scanned).toBe(2);
	});

	test("tools_by_name counts PreToolUse only", () => {
		const rep = aggregate({ events: baseA, repoRoot: "/tmp/fakerepo" });
		const sess = rep.sessions[0];
		expect(sess?.tools_by_name.Write).toBe(1); // only the Pre
		expect(sess?.tools_by_name.Read).toBe(1);
	});

	test("files_touched_top per session sorted desc", () => {
		const rep = aggregate({ events: baseA, repoRoot: "/tmp/fakerepo" });
		const sess = rep.sessions[0];
		const top = sess?.files_touched_top[0];
		expect(top?.file).toBe("src/a.ts");
		expect(top?.count).toBe(2);
	});

	test("agent_ids_seen contains distinct non-null ids", () => {
		const rep = aggregate({ events: baseA, repoRoot: "/tmp/fakerepo" });
		const sess = rep.sessions[0];
		expect(sess?.agent_ids_seen).toEqual(["sub-1"]);
	});

	test("first_ts and last_ts match the range of session events", () => {
		const rep = aggregate({ events: baseA, repoRoot: "/tmp/fakerepo" });
		const sess = rep.sessions[0];
		expect(sess?.first_ts).toBe("2026-04-14T10:00:00.000Z");
		expect(sess?.last_ts).toBe("2026-04-14T10:02:00.000Z");
	});

	test("sessions sorted by events desc", () => {
		const rep = aggregate({ events: [...baseA, ...baseB], repoRoot: "/tmp/fakerepo" });
		expect(rep.sessions[0]?.session_id).toBe("A");
		expect(rep.sessions[1]?.session_id).toBe("B");
	});

	test("global files_touched_top aggregates across sessions", () => {
		const rep = aggregate({ events: [...baseA, ...baseB], repoRoot: "/tmp/fakerepo" });
		const top = rep.files_touched_top[0];
		expect(top?.file).toBe("src/a.ts");
		expect(top?.count).toBe(2);
	});

	test("empty input → zero counts, empty arrays", () => {
		const rep = aggregate({ events: [], repoRoot: "/tmp/fakerepo" });
		expect(rep.events_total).toBe(0);
		expect(rep.sessions_scanned).toBe(0);
		expect(rep.sessions).toEqual([]);
		expect(rep.files_touched_top).toEqual([]);
	});

	test("events missing tool/file are tolerated", () => {
		const rep = aggregate({ events: baseB, repoRoot: "/tmp/fakerepo" });
		const sess = rep.sessions[0];
		expect(sess?.events).toBe(2);
		expect(sess?.tools_by_name.Write).toBe(1);
		expect(sess?.files_touched_top[0]?.file).toBe("src/c.ts");
	});

	test("aggregate includes loops/drift/retries summaries", () => {
		const rep = aggregate({ events: [], repoRoot: "/tmp/fakerepo" });
		expect(Array.isArray(rep.loops)).toBe(true);
		expect(Array.isArray(rep.drift)).toBe(true);
		expect(Array.isArray(rep.retries)).toBe(true);
	});
});

function preEvent(partial: Partial<TraceLine> & Pick<TraceLine, "ts" | "session_id">): TraceLine {
	return {
		event: "PreToolUse",
		agent_id: null,
		tool: partial.tool,
		file: partial.file,
		...partial,
	};
}

describe("detectLoops", () => {
	test("flags identical (tool,file) tuples repeating ≥ maxRepeats within windowSize", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				tool: "Write",
				file: "src/x.ts",
			}),
			preEvent({
				ts: "2026-04-18T10:00:05.000Z",
				session_id: "A",
				tool: "Write",
				file: "src/x.ts",
			}),
			preEvent({
				ts: "2026-04-18T10:00:10.000Z",
				session_id: "A",
				tool: "Write",
				file: "src/x.ts",
			}),
		];
		const findings = detectLoops({ events, windowSize: 5, maxRepeats: 3 });
		expect(findings.length).toBe(1);
		const first = findings[0];
		expect(first?.tool).toBe("Write");
		expect(first?.file).toBe("src/x.ts");
		expect(first?.count).toBeGreaterThanOrEqual(3);
		expect(first?.session_id).toBe("A");
	});

	test("does not flag below threshold", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				tool: "Edit",
				file: "src/x.ts",
			}),
			preEvent({
				ts: "2026-04-18T10:00:05.000Z",
				session_id: "A",
				tool: "Edit",
				file: "src/x.ts",
			}),
		];
		expect(detectLoops({ events, windowSize: 5, maxRepeats: 3 })).toEqual([]);
	});

	test("different files do not combine into a single loop", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				tool: "Write",
				file: "src/x.ts",
			}),
			preEvent({
				ts: "2026-04-18T10:00:01.000Z",
				session_id: "A",
				tool: "Write",
				file: "src/y.ts",
			}),
			preEvent({
				ts: "2026-04-18T10:00:02.000Z",
				session_id: "A",
				tool: "Write",
				file: "src/z.ts",
			}),
		];
		expect(detectLoops({ events, windowSize: 5, maxRepeats: 3 })).toEqual([]);
	});

	test("empty input → empty findings", () => {
		expect(detectLoops({ events: [], windowSize: 5, maxRepeats: 3 })).toEqual([]);
	});
});

describe("detectDrift", () => {
	const repoRoot = "/tmp/fakerepo";

	test("flags Write outside allowedFiles", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				tool: "Write",
				file: "content/posts/stolen.mdx",
			}),
		];
		const findings = detectDrift({
			events,
			allowedFiles: ["scripts/**", "src/**"],
			repoRoot,
		});
		expect(findings.length).toBe(1);
		const first = findings[0];
		expect(first?.file).toBe("content/posts/stolen.mdx");
	});

	test("allows writes inside allowed globs", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				tool: "Write",
				file: "scripts/new.ts",
			}),
			preEvent({
				ts: "2026-04-18T10:00:01.000Z",
				session_id: "A",
				tool: "Edit",
				file: "src/components/Foo.astro",
			}),
		];
		expect(detectDrift({ events, allowedFiles: ["scripts/**", "src/**"], repoRoot })).toEqual([]);
	});

	test("non-write tools are not flagged", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				tool: "Read",
				file: "content/posts/any.mdx",
			}),
		];
		expect(detectDrift({ events, allowedFiles: ["scripts/**"], repoRoot })).toEqual([]);
	});

	test("empty input → empty findings", () => {
		expect(detectDrift({ events: [], allowedFiles: ["**"], repoRoot })).toEqual([]);
	});
});

describe("detectDrift — path normalization (015)", () => {
	const repoRoot = "/tmp/fakerepo";

	test("absolute path under repoRoot matching allowlist is not drift", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-19T00:00:00.000Z",
				session_id: "S",
				tool: "Write",
				file: "/tmp/fakerepo/scripts/foo.ts",
			}),
		];
		expect(detectDrift({ events, allowedFiles: ["scripts/**"], repoRoot })).toEqual([]);
	});

	test("absolute path under repoRoot NOT in allowlist is drift", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-19T00:00:00.000Z",
				session_id: "S",
				tool: "Write",
				file: "/tmp/fakerepo/content/posts/sneaky.mdx",
			}),
		];
		const findings = detectDrift({
			events,
			allowedFiles: ["scripts/**"],
			repoRoot,
		});
		expect(findings.length).toBe(1);
		expect(findings[0]?.file).toBe("/tmp/fakerepo/content/posts/sneaky.mdx");
	});

	test("absolute path outside repoRoot is always drift", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-19T00:00:00.000Z",
				session_id: "S",
				tool: "Write",
				file: "/etc/passwd",
			}),
		];
		const findings = detectDrift({
			events,
			allowedFiles: ["**"],
			repoRoot,
		});
		expect(findings.length).toBe(1);
		expect(findings[0]?.file).toBe("/etc/passwd");
	});

	test("repo-relative path back-compat — matches allowlist", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-19T00:00:00.000Z",
				session_id: "S",
				tool: "Edit",
				file: "scripts/old-style.ts",
			}),
		];
		expect(detectDrift({ events, allowedFiles: ["scripts/**"], repoRoot })).toEqual([]);
	});

	test("trailing-slash repoRoot still strips correctly", () => {
		const events: TraceLine[] = [
			preEvent({
				ts: "2026-04-19T00:00:00.000Z",
				session_id: "S",
				tool: "Write",
				file: "/tmp/fakerepo/scripts/x.ts",
			}),
		];
		expect(
			detectDrift({
				events,
				allowedFiles: ["scripts/**"],
				repoRoot: "/tmp/fakerepo/",
			}),
		).toEqual([]);
	});
});

describe("detectRetryStorm", () => {
	test("flags ≥ threshold consecutive verify failures in same session", () => {
		const events: TraceLine[] = [
			{
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Bash",
				file: null,
				command: "bun run tasks:verify",
				status: "error",
			},
			{
				ts: "2026-04-18T10:00:10.000Z",
				session_id: "A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Bash",
				file: null,
				command: "bun run tasks:verify",
				status: "error",
			},
			{
				ts: "2026-04-18T10:00:20.000Z",
				session_id: "A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Bash",
				file: null,
				command: "bun run tasks:verify",
				status: "error",
			},
		];
		const findings = detectRetryStorm({ events, threshold: 3 });
		expect(findings.length).toBe(1);
		const first = findings[0];
		expect(first?.session_id).toBe("A");
		expect(first?.count).toBeGreaterThanOrEqual(3);
	});

	test("successful verify in between resets the streak", () => {
		const events: TraceLine[] = [
			{
				ts: "2026-04-18T10:00:00.000Z",
				session_id: "A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Bash",
				command: "bun run tasks:verify",
				status: "error",
			},
			{
				ts: "2026-04-18T10:00:05.000Z",
				session_id: "A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Bash",
				command: "bun run tasks:verify",
				status: "ok",
			},
			{
				ts: "2026-04-18T10:00:10.000Z",
				session_id: "A",
				event: "PostToolUse",
				agent_id: null,
				tool: "Bash",
				command: "bun run tasks:verify",
				status: "error",
			},
		];
		expect(detectRetryStorm({ events, threshold: 3 })).toEqual([]);
	});

	test("empty input → empty findings", () => {
		expect(detectRetryStorm({ events: [], threshold: 3 })).toEqual([]);
	});
});

describe("backward compat — old-shape TraceLine", () => {
	test("parses events without span fields", () => {
		const old: TraceLine = {
			ts: "2026-04-14T10:00:00.000Z",
			session_id: "legacy",
			event: "PreToolUse",
			agent_id: null,
			tool: "Write",
			file: "src/a.ts",
		};
		const rep = aggregate({ events: [old], repoRoot: "/tmp/fakerepo" });
		expect(rep.events_total).toBe(1);
		expect(rep.sessions[0]?.session_id).toBe("legacy");
		expect(rep.loops).toEqual([]);
		expect(rep.drift).toEqual([]);
		expect(rep.retries).toEqual([]);
	});

	test("TraceLine tolerates span_id / parent_span_id / started_at / duration_ms / status when present", () => {
		const modern: TraceLine = {
			ts: "2026-04-18T10:00:00.000Z",
			session_id: "modern",
			event: "PreToolUse",
			agent_id: null,
			tool: "Write",
			file: "src/b.ts",
			span_id: "abc",
			parent_span_id: "def",
			started_at: 1713436800000,
			duration_ms: 42,
			status: "ok",
		};
		expect(modern.span_id).toBe("abc");
		expect(modern.status).toBe("ok");
	});
});

/**
 * Spec 028 — hook-block-observability. RED gate.
 *
 * Scanner must expose `parseBlocked` / `renderBlocks`, include a `blocks`
 * array in the aggregate report, and `renderText()` must emit a `Blocks:`
 * section grouped by (session_id, reason, file) when ≥1 block exists —
 * and OMIT the header entirely when zero blocks exist.
 */
function blockedEvent(
	partial: Partial<TraceLine> & Pick<TraceLine, "ts" | "session_id"> & { reason: string },
): TraceLine {
	const { reason, ...rest } = partial;
	return {
		event: "ToolBlocked",
		agent_id: null,
		status: "blocked",
		tool: "Write",
		file: "wrangler.toml",
		...rest,
		// reason is a first-class field on blocked events; keep it on the line.
		// TraceLine schema will be widened in implementation to include `reason`.
		...({ reason } as unknown as Partial<TraceLine>),
	};
}

describe("parseBlocked — spec 028", () => {
	test("collapses repeated (session, reason, file) triples into one finding with a count", () => {
		const events: TraceLine[] = [
			blockedEvent({
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				reason:
					"wrangler.toml is a protected file. Create an active spec that targets it before editing.",
				tool: "Write",
				file: "wrangler.toml",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:05.000Z",
				session_id: "S1",
				reason:
					"wrangler.toml is a protected file. Create an active spec that targets it before editing.",
				tool: "Write",
				file: "wrangler.toml",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:10.000Z",
				session_id: "S1",
				reason: "Archived specs are immutable. Create a new spec that supersedes the previous one.",
				tool: "Edit",
				file: "specs/archive/2026-04-18-008-hook-fail-open/proposal.md",
			}),
		];
		const findings = parseBlocked(events);
		expect(findings.length).toBe(2);
		const wrangler = findings.find((f) => f.file === "wrangler.toml");
		expect(wrangler).toBeDefined();
		expect(wrangler?.count).toBe(2);
		expect(wrangler?.session_id).toBe("S1");
		expect(wrangler?.reason).toContain("wrangler.toml is a protected file");
	});

	test("non-blocked events are ignored", () => {
		const events: TraceLine[] = [
			{
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				event: "PreToolUse",
				agent_id: null,
				tool: "Write",
				file: "src/a.ts",
			},
			{
				ts: "2026-04-20T10:00:05.000Z",
				session_id: "S1",
				event: "PostToolUse",
				agent_id: null,
				tool: "Write",
				file: "src/a.ts",
				status: "ok",
			},
		];
		expect(parseBlocked(events)).toEqual([]);
	});

	test("empty input → empty findings", () => {
		expect(parseBlocked([])).toEqual([]);
	});

	test("different sessions stay in separate findings even with same reason+file", () => {
		const events: TraceLine[] = [
			blockedEvent({
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:05.000Z",
				session_id: "S2",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
		];
		const findings = parseBlocked(events);
		expect(findings.length).toBe(2);
	});
});

describe("renderBlocks — spec 028", () => {
	test("renders each finding as `[<sid>] <reason> → <file> ×<count>` under a `Blocks:` header", () => {
		const findings = parseBlocked([
			blockedEvent({
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:05.000Z",
				session_id: "S1",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:10.000Z",
				session_id: "S1",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
		]);
		const out = renderBlocks(findings);
		expect(out).toContain("Blocks:");
		expect(out).toContain("[S1]");
		expect(out).toContain("wrangler.toml is a protected file.");
		expect(out).toContain("→ wrangler.toml");
		expect(out).toContain("×3");
	});

	test("ordered by count desc, then first-seen asc", () => {
		const findings = parseBlocked([
			blockedEvent({
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				reason: "A",
				file: "a.ts",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:05.000Z",
				session_id: "S1",
				reason: "B",
				file: "b.ts",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:10.000Z",
				session_id: "S1",
				reason: "B",
				file: "b.ts",
			}),
		]);
		const out = renderBlocks(findings);
		const idxB = out.indexOf("→ b.ts");
		const idxA = out.indexOf("→ a.ts");
		expect(idxB).toBeGreaterThan(-1);
		expect(idxA).toBeGreaterThan(-1);
		expect(idxB).toBeLessThan(idxA);
	});

	test("empty findings → empty string (no header)", () => {
		const out = renderBlocks([]);
		expect(out).toBe("");
	});
});

describe("aggregate.blocks + renderText `Blocks:` section — spec 028", () => {
	test("aggregate includes a `blocks` array surfaced by renderText", () => {
		const events: TraceLine[] = [
			blockedEvent({
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
			blockedEvent({
				ts: "2026-04-20T10:00:05.000Z",
				session_id: "S1",
				reason: "wrangler.toml is a protected file.",
				file: "wrangler.toml",
			}),
		];
		const rep = aggregate({ events, repoRoot: "/tmp/fakerepo" });
		expect(Array.isArray(rep.blocks)).toBe(true);
		expect(rep.blocks.length).toBe(1);
		const text = renderText(rep);
		expect(text).toContain("Blocks:");
		expect(text).toMatch(/\[S1\].*→ wrangler\.toml.*×2/);
	});

	test("zero blocks → no `Blocks:` header in renderText output", () => {
		const events: TraceLine[] = [
			{
				ts: "2026-04-20T10:00:00.000Z",
				session_id: "S1",
				event: "PreToolUse",
				agent_id: null,
				tool: "Write",
				file: "src/a.ts",
			},
		];
		const rep = aggregate({ events, repoRoot: "/tmp/fakerepo" });
		expect(rep.blocks).toEqual([]);
		const text = renderText(rep);
		expect(text).not.toContain("Blocks:");
	});
});
