// @no-test: gate tested via scripts/smoke-morning-digest.ts

/**
 * Morning digest agent — scans overnight /do-auto outcomes.
 *
 * Scans:
 *   - specs/archive/ (last 24h) → ✅ MERGED
 *   - specs/active/ (all) → ⏸ PAUSED (with reason heuristic)
 *   - .agentic/last-alignment.md (if status: needs-human) → ❓ NEEDS-HUMAN
 *
 * Output: .agentic/digest/YYYY-MM-DD.md (gitignored)
 *
 * Usage:
 *   bun scripts/morning-digest.ts [<repo-root>]
 *   (defaults to process.cwd())
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface MergedSpec {
	id: string;
	title: string;
	date: string;
}

interface PausedSpec {
	id: string;
	reason: string;
}

interface NeedsHuman {
	intent: string;
	reason: string;
}

export function generateDigest(repoRoot: string): string {
	const today = new Date().toISOString().split("T")[0] ?? "unknown";
	const archiveDir = join(repoRoot, "specs", "archive");
	const activeDir = join(repoRoot, "specs", "active");
	const mailboxPath = join(repoRoot, ".agentic", "last-alignment.md");

	// Scan archive for last 24h
	const merged: MergedSpec[] = [];
	if (existsSync(archiveDir)) {
		const now = Date.now();
		const oneDayAgo = now - 24 * 60 * 60 * 1000;

		for (const entry of readdirSync(archiveDir)) {
			const fullPath = join(archiveDir, entry);
			const stat = statSync(fullPath);
			if (!stat.isDirectory()) continue;

			// Check if created in last 24h
			if (stat.ctimeMs >= oneDayAgo) {
				// Parse spec ID and title from proposal.md if exists
				const proposalPath = join(fullPath, "proposal.md");
				let id = entry;
				let title = entry;
				let date = today;

				if (existsSync(proposalPath)) {
					const proposalContent = readFileSync(proposalPath, "utf-8");
					const idMatch = proposalContent.match(/^id:\s*(.+)$/m);
					const titleMatch = proposalContent.match(/^title:\s*(.+)$/m);
					const createdMatch = proposalContent.match(/^created:\s*(.+)$/m);
					if (idMatch?.[1]) id = idMatch[1].trim();
					if (titleMatch?.[1]) title = titleMatch[1].trim();
					if (createdMatch?.[1]) date = createdMatch[1].trim();
				}

				merged.push({ id, title, date });
			}
		}
	}

	// Scan active specs for paused state
	const paused: PausedSpec[] = [];
	if (existsSync(activeDir)) {
		for (const entry of readdirSync(activeDir)) {
			const fullPath = join(activeDir, entry);
			const stat = statSync(fullPath);
			if (!stat.isDirectory()) continue;

			// Apply reason heuristic (priority order)
			let reason = "in progress (no escalation)";

			const ciFailurePath = join(fullPath, "ci-failure.md");
			if (existsSync(ciFailurePath)) {
				reason = "CI red";
			} else {
				// Check for judge rejection (tester-review-*.md with ## ESCALATION)
				const files = readdirSync(fullPath);
				let hasJudgeRejection = false;
				for (const file of files) {
					if (file.startsWith("tester-review-") && file.endsWith(".md")) {
						const reviewPath = join(fullPath, file);
						const reviewContent = readFileSync(reviewPath, "utf-8");
						if (reviewContent.includes("## ESCALATION")) {
							hasJudgeRejection = true;
							break;
						}
					}
				}

				if (hasJudgeRejection) {
					reason = "judge rejection";
				} else {
					const replanEscalationPath = join(fullPath, "replan-escalation.md");
					if (existsSync(replanEscalationPath)) {
						reason = "replan escalation";
					}
				}
			}

			paused.push({ id: entry, reason });
		}
	}

	// Check mailbox for needs-human
	let needsHuman: NeedsHuman | null = null;
	if (existsSync(mailboxPath)) {
		const mailboxContent = readFileSync(mailboxPath, "utf-8");
		const fmMatch = mailboxContent.match(/^---\n([\s\S]*?)\n---/);
		if (fmMatch) {
			const fmText = fmMatch[1] ?? "";
			const statusMatch = fmText.match(/^status:\s*(.+)$/m);
			const status = statusMatch?.[1]?.trim();

			if (status === "needs-human") {
				// Extract intent from body (first H2 Goal section)
				const goalMatch = mailboxContent.match(/## Goal\n\n(.+)/);
				const intent = goalMatch?.[1]?.trim() ?? "unknown intent";

				// Reason can be inferred from confidence or explicit field
				const confidenceMatch = fmText.match(/^confidence:\s*(.+)$/m);
				const confidence = confidenceMatch?.[1]?.trim();
				const reason = confidence === "low" ? "low confidence" : "ambiguous intent";

				needsHuman = { intent, reason };
			}
		}
	}

	// Format digest
	let digest = `# Morning Digest — ${today}\n\n`;

	digest += `## ✅ MERGED (${merged.length})\n\n`;
	if (merged.length === 0) {
		digest += "No specs merged in the last 24h.\n\n";
	} else {
		for (const spec of merged) {
			digest += `- **${spec.id}**: ${spec.title} (${spec.date})\n`;
		}
		digest += "\n";
	}

	digest += `## ⏸ PAUSED (${paused.length})\n\n`;
	if (paused.length === 0) {
		digest += "No active specs with escalations.\n\n";
	} else {
		for (const spec of paused) {
			digest += `- **${spec.id}**: ${spec.reason}\n`;
		}
		digest += "\n";
	}

	digest += `## ❓ NEEDS-HUMAN (${needsHuman ? 1 : 0})\n\n`;
	if (!needsHuman) {
		digest += "No intents awaiting human review.\n\n";
	} else {
		digest += `- **Intent**: ${needsHuman.intent}\n`;
		digest += `- **Reason**: ${needsHuman.reason}\n\n`;
	}

	return digest;
}

function main(): void {
	const repoRoot = process.argv[2] ?? process.cwd();
	const digest = generateDigest(repoRoot);

	// Write to .agentic/digest/YYYY-MM-DD.md
	const today = new Date().toISOString().split("T")[0] ?? "unknown";
	const digestDir = join(repoRoot, ".agentic", "digest");
	mkdirSync(digestDir, { recursive: true });

	const digestPath = join(digestDir, `${today}.md`);
	writeFileSync(digestPath, digest, "utf-8");

	// Print summary to stdout
	process.stdout.write(`Morning digest written to ${digestPath}\n`);
	process.stdout.write(`\n${digest}`);
}

if (import.meta.main) {
	main();
}
