export interface AgeBuckets {
	ltOneHour: number;
	oneToTwentyFour: number;
	gtTwentyFour: number;
}

interface PrEntry {
	headRefName: string;
	createdAt: string;
}

export function parseAgeBuckets(rawJson: string, now: Date): AgeBuckets {
	const entries = JSON.parse(rawJson) as PrEntry[];
	const nowMs = now.getTime();
	const oneHourMs = 3600 * 1000;
	const twentyFourHourMs = 86400 * 1000;
	const buckets: AgeBuckets = { ltOneHour: 0, oneToTwentyFour: 0, gtTwentyFour: 0 };
	for (const entry of entries) {
		if (!entry.headRefName.startsWith("auto/")) continue;
		const ageMs = nowMs - new Date(entry.createdAt).getTime();
		if (ageMs < oneHourMs) {
			buckets.ltOneHour++;
		} else if (ageMs < twentyFourHourMs) {
			buckets.oneToTwentyFour++;
		} else {
			buckets.gtTwentyFour++;
		}
	}
	return buckets;
}

export function formatAgeLine(buckets: AgeBuckets): string {
	const total = buckets.ltOneHour + buckets.oneToTwentyFour + buckets.gtTwentyFour;
	return `${total} branches in flight: ${buckets.ltOneHour} < 1h, ${buckets.oneToTwentyFour} 1-24h, ${buckets.gtTwentyFour} > 24h`;
}

async function main(): Promise<void> {
	const result = await Bun.$`gh pr list --state open --json headRefName,createdAt`.quiet();
	console.log(formatAgeLine(parseAgeBuckets(result.stdout.toString(), new Date())));
}

if (import.meta.main) {
	await main();
}
