export interface Tally {
	draft: number;
	open: number;
	closed: number;
}

interface PrEntry {
	headRefName: string;
	state: "OPEN" | "CLOSED" | "MERGED";
	isDraft: boolean;
}

export function parsePrList(rawJson: string): Tally {
	const entries = JSON.parse(rawJson) as PrEntry[];
	const tally: Tally = { draft: 0, open: 0, closed: 0 };
	for (const entry of entries) {
		if (!entry.headRefName.startsWith("auto/")) continue;
		if (entry.state === "OPEN" && entry.isDraft) {
			tally.draft++;
		} else if (entry.state === "OPEN") {
			tally.open++;
		} else {
			tally.closed++;
		}
	}
	return tally;
}

export function formatLine(tally: Tally): string {
	const total = tally.draft + tally.open + tally.closed;
	return `${total} branches in flight: ${tally.draft} draft, ${tally.open} open, ${tally.closed} closed`;
}

async function main(): Promise<void> {
	const result = await Bun.$`gh pr list --state all --json headRefName,state,isDraft`.quiet();
	console.log(formatLine(parsePrList(result.stdout.toString())));
}

if (import.meta.main) {
	await main();
}
