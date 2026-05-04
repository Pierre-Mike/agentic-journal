/**
 * Synthesize legacy `.agentic/last-alignment.md` mailbox from GitHub issue.
 *
 * Usage:
 *   bun scripts/issue-to-mailbox.ts <issueNumber>
 *
 * Converts an issue's alignment section into the mailbox format expected by
 * existing subagents (spec-tester, spec-judge) and skills (/do-auto, morning-digest).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Process } from "./_lib.ts";
import { realProcess } from "./_lib.ts";
import { loadIssue } from "./issue.ts";

export interface Options {
	readonly outputPath?: string; // default: ".agentic/last-alignment.md" relative to CWD
	readonly repo?: string; // gh --repo passthrough
	readonly now?: () => Date; // injectable for tests
}

export async function issueToMailbox(
	issueNumber: number,
	p: Process,
	opts?: Options,
): Promise<{ outputPath: string; content: string }> {
	const issue = await loadIssue(issueNumber, p, { repo: opts?.repo });

	if (issue.parsed.alignment === null) {
		throw new Error(`issue #${issueNumber} has no alignment`);
	}

	const alignment = issue.parsed.alignment;

	// Compute intent_hash
	const intentHash = new Bun.CryptoHasher("sha256")
		.update(issue.parsed.intent)
		.digest("hex")
		.slice(0, 12);

	// Build frontmatter
	const created = (opts?.now?.() ?? new Date()).toISOString();
	const frontmatter = `---
created: ${created}
status: confirmed
confidence: ${alignment.confidence}
intent_hash: ${intentHash}
---`;

	// Build sections
	const sections: string[] = [];

	sections.push("## Goal", "", alignment.goal, "");

	sections.push("## Big Picture", "", alignment.bigPicture, "");

	sections.push("## Straightforward Details", "");
	if (alignment.straightforward.length > 0) {
		for (const item of alignment.straightforward) {
			sections.push(`- ${item}`);
		}
	}
	sections.push("");

	sections.push("## Non-obvious Decisions", "");
	if (alignment.nonObvious.length > 0) {
		for (const item of alignment.nonObvious) {
			sections.push(`- ${item}`);
		}
	}
	sections.push("");

	const content = `${[frontmatter, "", ...sections].join("\n").trimEnd()}\n`;

	const outputPath = opts?.outputPath ?? ".agentic/last-alignment.md";

	// Ensure parent directory exists
	const parentDir = dirname(outputPath);
	mkdirSync(parentDir, { recursive: true });

	writeFileSync(outputPath, content, "utf-8");

	return { outputPath, content };
}

if (import.meta.main) {
	try {
		const args = process.argv.slice(2);
		const issueNumberStr = args[0];
		if (!issueNumberStr) {
			throw new Error("Missing issue number argument");
		}

		const issueNumber = Number.parseInt(issueNumberStr, 10);
		if (!Number.isFinite(issueNumber)) {
			throw new Error(`Invalid issue number: ${issueNumberStr}`);
		}

		const { outputPath } = await issueToMailbox(issueNumber, realProcess);
		// biome-ignore lint/suspicious/noConsole: CLI entrypoint
		console.log(`✓ wrote ${outputPath}`);
	} catch (err) {
		// biome-ignore lint/suspicious/noConsole: CLI entrypoint
		console.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
