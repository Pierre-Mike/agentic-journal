// @no-test: sibling test is scripts/issue-options.test.ts (frozen gate, not staged per parallel-agent constraint)
/**
 * Failure menu helpers for the issue→PR pipeline.
 *
 * renderFailureMenu  — produces a markdown issue-comment body with 4 options
 * parseFailureChoice — parses a user reply and returns the single ticked choice
 */

export interface FailureMenuInput {
	sliceId: string;
	sliceTitle: string;
	attemptCount: number;
	lastError: string;
	runUrl: string;
}

export type FailureChoice = "retry" | "split" | "skip" | "abort";

const VALID_CHOICES: ReadonlySet<string> = new Set<FailureChoice>([
	"retry",
	"split",
	"skip",
	"abort",
]);

/**
 * Returns a deterministic markdown body for a failure menu comment.
 * Includes slice metadata and a 4-option checkbox list.
 */
export function renderFailureMenu(input: FailureMenuInput): string {
	const { sliceId, sliceTitle, attemptCount, lastError, runUrl } = input;
	return [
		`**Slice ${sliceId} failed** — ${sliceTitle}`,
		``,
		`Attempt **${attemptCount}** ended with: \`${lastError}\``,
		``,
		`Run log: ${runUrl}`,
		``,
		`Tick **one** box and save the comment to continue:`,
		``,
		`- [ ] retry`,
		`- [ ] split`,
		`- [ ] skip`,
		`- [ ] abort`,
	].join("\n");
}

/**
 * Parses a user reply comment body.
 * Returns the single checked valid choice, or null if ambiguous / none / unrecognised.
 */
export function parseFailureChoice(commentBody: string): FailureChoice | null {
	const matches = [...commentBody.matchAll(/- \[[xX]\] (\S+)/g)]
		.map((m) => m[1])
		.filter((l): l is string => l !== undefined);

	if (matches.length !== 1) {
		return null;
	}

	const label = matches[0] ?? "";
	if (!VALID_CHOICES.has(label)) {
		return null;
	}

	return label as FailureChoice;
}
