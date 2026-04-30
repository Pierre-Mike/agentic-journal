import { z } from "zod";

const TokenUsageSchema = z.object({
	type: z.literal("token_usage"),
	session_id: z.string(),
	input_tokens: z.number(),
	output_tokens: z.number(),
	started_at: z.string(),
	duration_ms: z.number(),
});

const ToolUseSchema = z.object({
	type: z.literal("tool_use"),
	session_id: z.string(),
	tool: z.string(),
});

const TraceEventSchema = z.union([TokenUsageSchema, ToolUseSchema]);

export type TraceEvent = z.infer<typeof TraceEventSchema>;

export interface ReportData {
	readonly sessionCount: number;
	readonly totalInputTokens: number;
	readonly totalOutputTokens: number;
	readonly totalDurationMs: number;
	readonly toolCounts: Record<string, number>;
	readonly topByTokens: ReadonlyArray<{
		readonly id: string;
		readonly tokens: number;
		readonly durationMs: number;
	}>;
	readonly topByDuration: ReadonlyArray<{
		readonly id: string;
		readonly tokens: number;
		readonly durationMs: number;
	}>;
}

export function parseTraceContent(content: string): TraceEvent[] {
	if (content.trim() === "") return [];
	return content
		.split("\n")
		.filter((line) => line.trim() !== "")
		.flatMap((line) => {
			const result = TraceEventSchema.safeParse(JSON.parse(line));
			return result.success ? [result.data] : [];
		});
}

export function buildReport(files: Record<string, string>): ReportData {
	const toolCounts: Record<string, number> = {};
	type SessionEntry = {
		id: string;
		inputTokens: number;
		outputTokens: number;
		durationMs: number;
	};
	const sessionMap: Record<string, SessionEntry> = {};

	for (const [filename, content] of Object.entries(files)) {
		const id = filename.replace(/\.[^.]+$/, "");
		const events = parseTraceContent(content);

		let inputTokens = 0;
		let outputTokens = 0;
		let durationMs = 0;

		for (const event of events) {
			if (event.type === "token_usage") {
				inputTokens += event.input_tokens;
				outputTokens += event.output_tokens;
				durationMs += event.duration_ms;
			} else {
				toolCounts[event.tool] = (toolCounts[event.tool] ?? 0) + 1;
			}
		}

		sessionMap[id] = { id, inputTokens, outputTokens, durationMs };
	}

	const sessions = Object.values(sessionMap);
	const totalInputTokens = sessions.reduce((sum, s) => sum + s.inputTokens, 0);
	const totalOutputTokens = sessions.reduce((sum, s) => sum + s.outputTokens, 0);
	const totalDurationMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);

	const ranked = sessions.map((s) => ({
		id: s.id,
		tokens: s.inputTokens + s.outputTokens,
		durationMs: s.durationMs,
	}));

	const topByTokens = [...ranked].sort((a, b) => b.tokens - a.tokens).slice(0, 5);
	const topByDuration = [...ranked].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);

	return {
		sessionCount: sessions.length,
		totalInputTokens,
		totalOutputTokens,
		totalDurationMs,
		toolCounts,
		topByTokens,
		topByDuration,
	};
}

function formatDuration(ms: number): string {
	const secs = Math.floor(ms / 1000);
	if (secs < 60) return `${secs}s`;
	const mins = Math.floor(secs / 60);
	const rem = secs % 60;
	return `${mins}m ${rem}s`;
}

export function formatReport(data: ReportData): string {
	if (data.sessionCount === 0) return "no trace data yet.";

	const totalTokens = data.totalInputTokens + data.totalOutputTokens;
	const lines: string[] = [];

	lines.push(
		`${data.sessionCount} sessions | ${totalTokens} total tokens (in: ${data.totalInputTokens}, out: ${data.totalOutputTokens}) | ${formatDuration(data.totalDurationMs)} total wall-clock`,
	);
	lines.push("");

	lines.push("Top 5 by tokens:");
	for (const s of data.topByTokens) {
		lines.push(`  ${s.id.slice(0, 8)}  ${s.tokens}  ${formatDuration(s.durationMs)}`);
	}
	lines.push("");

	lines.push("Top 5 by duration:");
	for (const s of data.topByDuration) {
		lines.push(`  ${s.id.slice(0, 8)}  ${s.tokens}  ${formatDuration(s.durationMs)}`);
	}
	lines.push("");

	lines.push("Per-tool call counts:");
	const sortedTools = Object.entries(data.toolCounts).sort(([, a], [, b]) => b - a);
	for (const [tool, count] of sortedTools) {
		lines.push(`  ${tool}  ${count}`);
	}

	return lines.join("\n");
}

async function main(): Promise<void> {
	const traceFiles = await Array.fromAsync(new Bun.Glob(".claude/traces/*.jsonl").scan("."));
	const files: Record<string, string> = {};
	for (const path of traceFiles) {
		const filename = path.split("/").pop() ?? path;
		files[filename] = await Bun.file(path).text();
	}
	console.log(formatReport(buildReport(files)));
}

if (import.meta.main) {
	await main();
}
