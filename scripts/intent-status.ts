export interface IntentEntry {
	issue: number;
	slug: string;
	ageSeconds: number;
}

export function formatAge(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	return `${days}d ${String(hours).padStart(2, " ")}h`;
}

export function parseBranch(ref: string): { issue: number; slug: string } | null {
	const m = /(?:^|\/)auto\/(\d+)-(.+)$/.exec(ref);
	if (!m) return null;
	return { issue: parseInt(m[1] as string, 10), slug: m[2] as string };
}

export function formatTable(entries: IntentEntry[]): string {
	if (entries.length === 0) return "no in-flight intents.";

	const sorted = [...entries].sort((a, b) => b.ageSeconds - a.ageSeconds);

	const header = `${entries.length} in-flight intents:\n`;
	const rows = sorted.map((e) => `  #${e.issue}  ${e.slug}  ${formatAge(e.ageSeconds)}`).join("\n");

	return header + rows;
}

async function main(): Promise<void> {
	const fmt = "%(refname:short) %(committerdate:unix)";
	const result =
		await Bun.$`git for-each-ref refs/remotes/origin/auto/ --format=${fmt} --sort=committerdate`.quiet();

	const entries: IntentEntry[] = [];
	const now = Math.floor(Date.now() / 1000);

	for (const line of result.stdout.toString().split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const spaceIdx = trimmed.lastIndexOf(" ");
		const ref = trimmed.slice(0, spaceIdx);
		const epoch = parseInt(trimmed.slice(spaceIdx + 1), 10);
		const parsed = parseBranch(ref);
		if (!parsed) continue;
		entries.push({ ...parsed, ageSeconds: now - epoch });
	}

	console.log(formatTable(entries));
}

if (import.meta.main) {
	await main();
}
