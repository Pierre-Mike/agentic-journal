import type { TraceScanReport } from "./agentic/trace-scan.ts";
import { aggregate, loadTraces } from "./agentic/trace-scan.ts";

export function formatReport(report: TraceScanReport): string {
	const merged = new Map<string, number>();
	for (const s of report.sessions) {
		for (const [name, count] of Object.entries(s.tools_by_name)) {
			merged.set(name, (merged.get(name) ?? 0) + count);
		}
	}
	const toolsStr = Array.from(merged.entries())
		.sort((a, b) => b[1] - a[1])
		.map(([name, count]) => `${name}(${count})`)
		.join(", ");
	const filesStr = report.files_touched_top.map((f) => `${f.file}(${f.count})`).join(", ");

	return [
		`sessions: ${report.sessions_scanned}  events: ${report.events_total}`,
		`top tools: ${toolsStr}`,
		`top files: ${filesStr}`,
		`anomalies: loops=${report.loops.length} drift=${report.drift.length} retries=${report.retries.length} blocks=${report.blocks.length}`,
	].join("\n");
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	let tracesDir = ".claude/traces";
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = argv[i + 1];
		if (arg === "--traces-dir" && next !== undefined) {
			tracesDir = next;
			i++;
		}
	}
	const events = loadTraces(tracesDir, null);
	const report = aggregate({ events, repoRoot: process.cwd() });
	console.log(formatReport(report));
}

if (import.meta.main) {
	await main();
}
