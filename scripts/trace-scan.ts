/**
 * Stub for spec 005-trace-scan. Will be implemented in Task 2.
 * This file exists only so typecheck passes on the RED commit.
 */

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

// Stub implementations — real bodies come in Task 2.
export function parseSince(_input: string | undefined, _now: Date): Date | null {
	throw new Error("not implemented");
}

export function aggregate(_events: TraceLine[]): TraceScanReport {
	throw new Error("not implemented");
}

export function topN<T>(_counts: Map<T, number>, _n: number): { key: T; count: number }[] {
	throw new Error("not implemented");
}

export function loadTraces(_dir: string, _sessionFilter: string | null): TraceLine[] {
	throw new Error("not implemented");
}

export function renderText(_report: TraceScanReport): string {
	throw new Error("not implemented");
}

export async function run(_argv: string[]): Promise<number> {
	throw new Error("not implemented");
}

if (import.meta.main) {
	await run(process.argv);
}
