/**
 * Deterministic aggregator over `.claude/traces/*.jsonl`.
 *
 * Surface runtime patterns — events per session, tool frequencies (PreToolUse
 * only, by design), files touched — that `/retro` can rely on instead of
 * reconstructing from narrative.
 *
 * v2 (011): adds three pure detector functions (detectLoops / detectDrift /
 * detectRetryStorm) and widens TraceLine with optional span-hierarchy fields
 * (span_id, parent_span_id, started_at, duration_ms, status, command). Old
 * jsonl lines still parse — every new field is optional.
 *
 * Read-all is intentional: the traces dir is currently ~16 KB. If any single
 * `.jsonl` exceeds ~5 MB, switch loadTraces to readline streaming.
 *
 * Malformed JSON lines are silently skipped (symmetry with observe.ts's
 * never-throw contract). Unknown fields pass through.
 *
 * Unit tests for pure fns (parseSince, aggregate, topN, detectLoops,
 * detectDrift, detectRetryStorm, backward-compat) live in
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
	span_id?: string;
	parent_span_id?: string;
	started_at?: number;
	duration_ms?: number;
	status?: "ok" | "error" | "blocked";
	command?: string;
}

export interface FileCount {
	file: string;
	count: number;
}

export interface LoopFinding {
	session_id: string;
	tool: string;
	file: string;
	count: number;
	first_ts: string;
	last_ts: string;
}

export interface DriftFinding {
	session_id: string;
	tool: string;
	file: string;
	ts: string;
}

export interface RetryFinding {
	session_id: string;
	count: number;
	first_ts: string;
	last_ts: string;
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
	loops: LoopFinding[];
	drift: DriftFinding[];
	retries: RetryFinding[];
}

const DAYS_RE = /^(\d+)d$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Tools whose file arg counts as a write (subject to drift detection). */
const WRITE_TOOLS: ReadonlySet<string> = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/** Default drift allowlist — repo-wide write-safe globs. */
const DEFAULT_ALLOWED_FILES: readonly string[] = [
	"scripts/**",
	"src/**",
	"tests/**",
	"specs/**",
	".agentic/**",
	".claude/**",
	"*.md",
];

/** Commands that constitute a "verify" call for retry-storm detection. */
const VERIFY_COMMAND_RE = /\b(tasks:verify|spec:lint|check|test)\b/;

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

/**
 * detectLoops — slide a rolling window of `windowSize` ordered events per
 * session. Whenever a `(tool,file)` tuple appears ≥ `maxRepeats` times in the
 * current window, emit a finding. At most one finding per tuple+session.
 */
export function detectLoops(params: {
	events: readonly TraceLine[];
	windowSize: number;
	maxRepeats: number;
}): LoopFinding[] {
	const { events, windowSize, maxRepeats } = params;
	if (windowSize <= 0 || maxRepeats <= 0 || events.length === 0) return [];

	const bySession = groupBySession(events);
	const findings: LoopFinding[] = [];

	for (const [sessionId, list] of bySession) {
		const sorted = [...list].sort((a, b) => a.ts.localeCompare(b.ts));
		const seen = new Set<string>();

		for (let i = 0; i < sorted.length; i++) {
			const window = sorted.slice(i, i + windowSize);
			if (window.length < maxRepeats) break;
			const counts = new Map<string, { count: number; first: string; last: string }>();
			for (const ev of window) {
				if (ev.tool === undefined) continue;
				if (ev.file === undefined || ev.file === null) continue;
				const key = `${ev.tool}|${ev.file}`;
				const prev = counts.get(key);
				if (prev) {
					prev.count += 1;
					if (ev.ts < prev.first) prev.first = ev.ts;
					if (ev.ts > prev.last) prev.last = ev.ts;
				} else {
					counts.set(key, { count: 1, first: ev.ts, last: ev.ts });
				}
			}
			for (const [key, agg] of counts) {
				if (agg.count >= maxRepeats && !seen.has(key)) {
					seen.add(key);
					const [tool, file] = splitLoopKey(key);
					findings.push({
						session_id: sessionId,
						tool,
						file,
						count: agg.count,
						first_ts: agg.first,
						last_ts: agg.last,
					});
				}
			}
		}
	}

	return findings;
}

/**
 * detectDrift — flag write-class events whose `file` does not match any entry
 * in `allowedFiles`. Supports minimal globs: `**` (any path segments), `*`
 * (any chars within a segment).
 */
export function detectDrift(params: {
	events: readonly TraceLine[];
	allowedFiles: readonly string[];
}): DriftFinding[] {
	const { events, allowedFiles } = params;
	const patterns = allowedFiles.map(compileGlob);
	const findings: DriftFinding[] = [];
	for (const ev of events) {
		if (ev.tool === undefined || !WRITE_TOOLS.has(ev.tool)) continue;
		if (ev.file === undefined || ev.file === null) continue;
		const file = ev.file;
		if (!patterns.some((re) => re.test(file))) {
			findings.push({ session_id: ev.session_id, tool: ev.tool, file, ts: ev.ts });
		}
	}
	return findings;
}

/**
 * detectRetryStorm — scan chronologically per session; count consecutive
 * verify-class failures. Emit a finding when the streak hits `threshold`.
 */
export function detectRetryStorm(params: {
	events: readonly TraceLine[];
	threshold: number;
}): RetryFinding[] {
	const { events, threshold } = params;
	if (threshold <= 0 || events.length === 0) return [];

	const bySession = groupBySession(events);
	const findings: RetryFinding[] = [];

	for (const [sessionId, list] of bySession) {
		const sorted = [...list].sort((a, b) => a.ts.localeCompare(b.ts));
		let streak = 0;
		let firstTs = "";
		let lastTs = "";
		let alreadyEmitted = false;

		for (const ev of sorted) {
			if (!isVerifyEvent(ev)) continue;
			if (ev.status === "error") {
				if (streak === 0) firstTs = ev.ts;
				streak += 1;
				lastTs = ev.ts;
				if (streak >= threshold && !alreadyEmitted) {
					findings.push({
						session_id: sessionId,
						count: streak,
						first_ts: firstTs,
						last_ts: lastTs,
					});
					alreadyEmitted = true;
				} else if (streak >= threshold && alreadyEmitted) {
					const existing = findings[findings.length - 1];
					if (existing !== undefined && existing.session_id === sessionId) {
						existing.count = streak;
						existing.last_ts = lastTs;
					}
				}
			} else {
				streak = 0;
				alreadyEmitted = false;
				firstTs = "";
				lastTs = "";
			}
		}
	}

	return findings;
}

function groupBySession(events: readonly TraceLine[]): Map<string, TraceLine[]> {
	const m = new Map<string, TraceLine[]>();
	for (const ev of events) {
		const arr = m.get(ev.session_id);
		if (arr) arr.push(ev);
		else m.set(ev.session_id, [ev]);
	}
	return m;
}

function splitLoopKey(key: string): [string, string] {
	const idx = key.indexOf("|");
	if (idx < 0) return [key, ""];
	return [key.slice(0, idx), key.slice(idx + 1)];
}

function isVerifyEvent(ev: TraceLine): boolean {
	if (ev.command !== undefined && VERIFY_COMMAND_RE.test(ev.command)) return true;
	return false;
}

function compileGlob(pattern: string): RegExp {
	// Minimal glob: `**` → `.*`, `*` → `[^/]*`, escape other regex meta.
	let out = "";
	let i = 0;
	while (i < pattern.length) {
		const ch = pattern[i];
		if (ch === "*") {
			if (pattern[i + 1] === "*") {
				out += ".*";
				i += 2;
				if (pattern[i] === "/") i += 1;
			} else {
				out += "[^/]*";
				i += 1;
			}
		} else if (ch !== undefined && /[.+?^${}()|[\]\\]/.test(ch)) {
			out += `\\${ch}`;
			i += 1;
		} else if (ch !== undefined) {
			out += ch;
			i += 1;
		}
	}
	return new RegExp(`^${out}$`);
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
		loops: detectLoops({ events, windowSize: 10, maxRepeats: 3 }),
		drift: detectDrift({ events, allowedFiles: DEFAULT_ALLOWED_FILES }),
		retries: detectRetryStorm({ events, threshold: 3 }),
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
	if (report.loops.length > 0) {
		lines.push("");
		lines.push("Loops:");
		for (const l of report.loops) {
			lines.push(`  [${l.session_id}] ${l.tool} ${l.file} ×${l.count}`);
		}
	}
	if (report.drift.length > 0) {
		lines.push("");
		lines.push("Drift:");
		for (const d of report.drift) {
			lines.push(`  [${d.session_id}] ${d.tool} ${d.file} @ ${d.ts}`);
		}
	}
	if (report.retries.length > 0) {
		lines.push("");
		lines.push("Retry storms:");
		for (const r of report.retries) {
			lines.push(
				`  [${r.session_id}] ${r.count} consecutive verify failures [${r.first_ts} → ${r.last_ts}]`,
			);
		}
	}
	return lines.join("\n");
}

type DetectKind = "loops" | "drift" | "retries" | "all";

interface ParsedArgs {
	since: string | undefined;
	session: string | null;
	format: "text" | "json";
	tracesDir: string;
	detect: DetectKind;
}

function parseArgs(argv: string[]): ParsedArgs {
	const out: ParsedArgs = {
		since: undefined,
		session: null,
		format: "text",
		tracesDir: join(process.cwd(), ".claude", "traces"),
		detect: "all",
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
		} else if (a === "--detect") {
			const v = argv[++i];
			if (v === "loops" || v === "drift" || v === "retries" || v === "all") out.detect = v;
		}
	}
	return out;
}

function applyDetectFilter(report: TraceScanReport, detect: DetectKind): TraceScanReport {
	if (detect === "all") return report;
	return {
		...report,
		loops: detect === "loops" ? report.loops : [],
		drift: detect === "drift" ? report.drift : [],
		retries: detect === "retries" ? report.retries : [],
	};
}

export async function run(argv: string[]): Promise<number> {
	const args = parseArgs(argv.slice(2));
	const now = new Date();
	const cutoff = parseSince(args.since, now);
	const all = loadTraces(args.tracesDir, args.session);
	const filtered = cutoff === null ? all : all.filter((e) => new Date(e.ts) >= cutoff);
	const full = aggregate(filtered);
	const report = applyDetectFilter(full, args.detect);
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
