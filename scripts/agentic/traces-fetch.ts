import { join } from "node:path";

export type RunRecord = {
	databaseId: number;
	createdAt: string;
	conclusion: string | null;
};

const DAYS_RE = /^(\d+)d$/;

export function parseSince(since: string, ref: Date = new Date()): Date {
	const m = DAYS_RE.exec(since);
	if (m !== null) {
		const days = Number(m[1]);
		if (Number.isFinite(days)) {
			return new Date(ref.getTime() - days * 24 * 60 * 60 * 1000);
		}
	}
	return new Date(since);
}

export function filterRuns(runs: readonly RunRecord[], windowStart: Date): RunRecord[] {
	return runs.filter((r) => r.conclusion !== null && new Date(r.createdAt) >= windowStart);
}

function isRunRecord(x: unknown): x is RunRecord {
	if (x === null || typeof x !== "object") return false;
	const r = x as Record<string, unknown>;
	return (
		typeof r["databaseId"] === "number" &&
		typeof r["createdAt"] === "string" &&
		(r["conclusion"] === null || typeof r["conclusion"] === "string")
	);
}

function ghRunList(workflow: string): RunRecord[] {
	const result = Bun.spawnSync([
		"gh",
		"run",
		"list",
		"--workflow",
		workflow,
		"--json",
		"databaseId,createdAt,conclusion",
		"--limit",
		"50",
	]);
	if (result.exitCode !== 0) return [];
	try {
		const parsed: unknown = JSON.parse(result.stdout.toString());
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isRunRecord);
	} catch {
		return [];
	}
}

function ghRunDownload(runId: number, mirrorRoot: string): void {
	const dir = join(mirrorRoot, String(runId));
	Bun.spawnSync(["gh", "run", "download", String(runId), "--pattern", "traces-*", "--dir", dir]);
}

function main(): void {
	const args = process.argv.slice(2);
	let since = "7d";
	for (let i = 0; i < args.length; i++) {
		const flag = args[i];
		if (flag === "--since") {
			const val = args[i + 1];
			if (val !== undefined) {
				since = val;
				i++;
			}
		}
	}

	const windowStart = parseSince(since);
	const mirrorRoot =
		process.env["TRACES_MIRROR_ROOT"] ??
		join(import.meta.dir, "..", "..", ".claude", "traces-mirror");

	const allRuns: RunRecord[] = [];
	for (const workflow of ["intent.yml", "slice.yml"]) {
		allRuns.push(...ghRunList(workflow));
	}

	const filtered = filterRuns(allRuns, windowStart);
	for (const run of filtered) {
		ghRunDownload(run.databaseId, mirrorRoot);
	}
}

if (import.meta.main) {
	try {
		main();
	} catch {
		// best-effort: always exit 0
	}
}
