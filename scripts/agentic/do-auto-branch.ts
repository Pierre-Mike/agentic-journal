// @no-test: tested via scripts/smoke-do-auto-flow.ts gate

/**
 * Parses the alignment mailbox at the given path and decides whether
 * /do-auto should proceed (high confidence + status:confirmed) or exit
 * cleanly (low confidence or status:needs-human).
 *
 * Used by:
 *   - scripts/smoke-do-auto-flow.ts (gate)
 *   - .claude/skills/do-auto/SKILL.md (headless /do entry)
 */

import { existsSync, readFileSync } from "node:fs";

export type BranchResult = { proceed: true } | { proceed: false; reason: string };

export function parseAlignmentAndBranch(mailboxPath: string): BranchResult {
	if (!existsSync(mailboxPath)) {
		return {
			proceed: false,
			reason: `mailbox not found at ${mailboxPath}`,
		};
	}

	const content = readFileSync(mailboxPath, "utf-8");
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fmMatch) {
		return {
			proceed: false,
			reason: "missing or invalid YAML frontmatter",
		};
	}

	const fmText = fmMatch[1] ?? "";
	const status = readKey(fmText, "status");
	const confidence = readKey(fmText, "confidence");

	if (status === null) {
		return { proceed: false, reason: "frontmatter missing 'status' key" };
	}
	if (confidence === null) {
		return { proceed: false, reason: "frontmatter missing 'confidence' key" };
	}

	if (status === "needs-human") {
		return {
			proceed: false,
			reason: "auto-aligner flagged intent as ambiguous (status: needs-human)",
		};
	}
	if (confidence === "low") {
		return {
			proceed: false,
			reason: "auto-aligner returned low confidence",
		};
	}
	if (status !== "confirmed") {
		return {
			proceed: false,
			reason: `unrecognised status: ${status} (expected confirmed | needs-human)`,
		};
	}
	if (confidence !== "high") {
		return {
			proceed: false,
			reason: `unrecognised confidence: ${confidence} (expected high | low)`,
		};
	}

	return { proceed: true };
}

function readKey(frontmatter: string, key: string): string | null {
	for (const line of frontmatter.split("\n")) {
		const m = line.match(/^([a-z_]+):\s*(.+)$/);
		if (m && m[1] === key) {
			return (m[2] ?? "").trim();
		}
	}
	return null;
}
