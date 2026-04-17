/**
 * Deterministic aggregator over `.claude/traces/*.jsonl`.
 *
 * Surface runtime patterns — events per session, tool frequencies (PreToolUse
 * only, by design), files touched — that `/retro` can rely on instead of
 * reconstructing from narrative.
 *
 * Read-all is intentional: the traces dir is currently ~16 KB. If any single
 * `.jsonl` exceeds ~5 MB, switch loadTraces to readline streaming.
 *
 * Malformed JSON lines are silently skipped (symmetry with observe.ts's
 * never-throw contract). Unknown fields pass through.
 *
 * Unit tests for pure fns (parseSince, aggregate, topN) live in
 * scripts/trace-scan.test.ts. IO (loadTraces, renderText, run) is covered by
 * scripts/smoke-trace-scan.ts.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export interface TraceLine {
	ts: string;
	session_id: string;
	event: string;
	agent_id: string | null;
	tool?: string;
	file?: string | null;
}

export interface FileCount {
	file: string;
	count: number;
}

export interface SessionAgg {
	session_id: string;
	events: number;
	first_ts: string;
	last_ts: string;
	tools_by_name: Record<string, number>;
	files_touched_top: FileCount[];
	agent_ids_seen: string[];
}

export interface TraceScanReport {
	since: string | null;
	sessions_scanned: number;
	events_total: number;
	sessions: SessionAgg[];
	files_touched_top: FileCount[];
}

const DAYS_RE = /^(\d+)d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSince(input: string | undefined, now: Date): Date | null {
	if (input === undefined) return null;
	const days = input.match(DAYS_RE);
	if (days) {
		const n = Number(days[1]);
		if (!Number.isFinite(n)) return null;
		return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
	}
	if (ISO_DATE_RE.test(input)) {
		const d = new Date(`${input}T00:00:00.000Z`);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

export function topN<T>(counts: Map<T, number>, n: number): { key: T; count: number }[] {
	const entries: { key: T; count: number }[] = [];
	for (const [key, count] of counts) entries.push({ key, count });
	entries.sort((a, b) => b.count - a.count);
	return entries.slice(0, n);
}

export function aggregate(events: TraceLine[]): TraceScanReport {
	const bySession = new Map<string, TraceLine[]>();
	for (const ev of events) {
		const arr = bySession.get(ev.session_id);
		if (arr) arr.push(ev);
		else bySession.set(ev.session_id, [ev]);
	}

	const globalFiles = new Map<string, number>();
	const sessions: SessionAgg[] = [];

	for (const [sessionId, list] of bySession) {
		const toolsByName = new Map<string, number>();
		const filesBySession = new Map<string, number>();
		const agentIds = new Set<string>();
		let firstTs = list[0]?.ts ?? "";
		let lastTs = list[0]?.ts ?? "";

		for (const ev of list) {
			if (ev.ts < firstTs) firstTs = ev.ts;
			if (ev.ts > lastTs) lastTs = ev.ts;
			if (ev.agent_id !== null && ev.agent_id !== undefined) agentIds.add(ev.agent_id);
			if (ev.event === "PreToolUse" && ev.tool !== undefined) {
				toolsByName.set(ev.tool, (toolsByName.get(ev.tool) ?? 0) + 1);
			}
			if (ev.file !== undefined && ev.file !== null) {
				filesBySession.set(ev.file, (filesBySession.get(ev.file) ?? 0) + 1);
				globalFiles.set(ev.file, (globalFiles.get(ev.file) ?? 0) + 1);
			}
		}

		const toolsRecord: Record<string, number> = {};
		for (const [k, v] of toolsByName) toolsRecord[k] = v;

		sessions.push({
			session_id: sessionId,
			events: list.length,
			first_ts: firstTs,
			last_ts: lastTs,
			tools_by_name: toolsRecord,
			files_touched_top: topN(filesBySession, 5).map((x) => ({ file: x.key, count: x.count })),
			agent_ids_seen: Array.from(agentIds).sort(),
		});
	}

	sessions.sort((a, b) => b.events - a.events);

	return {
		since: null,
		sessions_scanned: sessions.length,
		events_total: events.length,
		sessions,
		files_touched_top: topN(globalFiles, 10).map((x) => ({ file: x.key, count: x.count })),
	};
}

export function loadTraces(dir: string, sessionFilter: string | null): TraceLine[] {
	if (!existsSync(dir)) return [];
	const files = readdirSync(dir).filter((name) => name.endsWith(".jsonl"));
	const events: TraceLine[] = [];
	for (const name of files) {
		if (sessionFilter !== null && basename(name, ".jsonl") !== sessionFilter) continue;
		const raw = readFileSync(join(dir, name), "utf-8");
		for (const line of raw.split("\n")) {
			if (line.length === 0) continue;
			try {
				const parsed: unknown = JSON.parse(line);
				if (isTraceLine(parsed)) events.push(parsed);
			} catch {
				// Malformed JSON is silently skipped (mirror of observe.ts never-throw).
			}
		}
	}
	return events;
}

function isTraceLine(x: unknown): x is TraceLine {
	if (x === null || typeof x !== "object") return false;
	const r = x as Record<string, unknown>;
	return (
		typeof r.ts === "string" &&
		typeof r.session_id === "string" &&
		typeof r.event === "string" &&
		(r.agent_id === null || typeof r.agent_id === "string")
	);
}

export function renderText(report: TraceScanReport): string {
	const lines: string[] = [];
	lines.push(`Trace scan — ${report.sessions_scanned} session(s), ${report.events_total} event(s)`);
	if (report.since !== null) lines.push(`Since: ${report.since}`);
	lines.push("");
	for (const s of report.sessions) {
		lines.push(`session ${s.session_id} — ${s.events} event(s) [${s.first_ts} → ${s.last_ts}]`);
		const tools = Object.entries(s.tools_by_name)
			.sort((a, b) => b[1] - a[1])
			.map(([k, v]) => `${k}:${v}`)
			.join(" ");
		if (tools.length > 0) lines.push(`  tools: ${tools}`);
		if (s.files_touched_top.length > 0) {
			const files = s.files_touched_top.map((f) => `${f.file}(${f.count})`).join(" ");
			lines.push(`  files: ${files}`);
		}
		if (s.agent_ids_seen.length > 0) {
			lines.push(`  agents: ${s.agent_ids_seen.join(", ")}`);
		}
	}
	if (report.files_touched_top.length > 0) {
		lines.push("");
		lines.push("Top files (global):");
		for (const f of report.files_touched_top) lines.push(`  ${f.file} — ${f.count}`);
	}
	return lines.join("\n");
}

interface ParsedArgs {
	since: string | undefined;
	session: string | null;
	format: "text" | "json";
	tracesDir: string;
}

function parseArgs(argv: string[]): ParsedArgs {
	const out: ParsedArgs = {
		since: undefined,
		session: null,
		format: "text",
		tracesDir: join(process.cwd(), ".claude", "traces"),
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--since") {
			out.since = argv[++i];
		} else if (a === "--session") {
			out.session = argv[++i] ?? null;
		} else if (a === "--format") {
			const v = argv[++i];
			if (v === "json" || v === "text") out.format = v;
		} else if (a === "--traces-dir") {
			const v = argv[++i];
			if (v !== undefined) out.tracesDir = v;
		}
	}
	return out;
}

export async function run(argv: string[]): Promise<number> {
	const args = parseArgs(argv.slice(2));
	const now = new Date();
	const cutoff = parseSince(args.since, now);
	const all = loadTraces(args.tracesDir, args.session);
	const filtered = cutoff === null ? all : all.filter((e) => new Date(e.ts) >= cutoff);
	const report = aggregate(filtered);
	report.since = cutoff === null ? null : cutoff.toISOString();
	if (args.format === "json") {
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		process.stdout.write(`${renderText(report)}\n`);
	}
	return 0;
}

if (import.meta.main) {
	const code = await run(process.argv);
	process.exit(code);
}
