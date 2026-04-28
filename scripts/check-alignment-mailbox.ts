// @no-test: CLI gate script, tested via end-to-end spec execution

/**
 * Gate smoke check for alignment.md files.
 *
 * Usage: bun scripts/check-alignment-mailbox.ts <path-to-alignment.md>
 *
 * Validates:
 * - YAML frontmatter with 4 required keys: created, status, confidence, intent_hash
 * - 4 required H2 sections: Goal, Big Picture, Straightforward Details, Non-obvious Decisions
 *
 * Exits 0 on valid, non-zero with stderr message on invalid.
 */

import { readFileSync } from "node:fs";

const REQUIRED_FRONTMATTER_KEYS = ["created", "status", "confidence", "intent_hash"];
const REQUIRED_H2_SECTIONS = [
	"Goal",
	"Big Picture",
	"Straightforward Details",
	"Non-obvious Decisions",
];

function main() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error("Usage: bun scripts/check-alignment-mailbox.ts <path-to-alignment.md>");
		process.exit(1);
	}

	const filePath = args[0];
	if (!filePath) {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error("Missing file path argument");
		process.exit(1);
	}

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error(`Failed to read file: ${filePath}`);
		process.exit(1);
	}

	// Extract frontmatter
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error("Missing or invalid YAML frontmatter (expected ---\\n...\\n---)");
		process.exit(1);
	}

	const frontmatterText = frontmatterMatch[1];
	if (!frontmatterText) {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error("Empty frontmatter");
		process.exit(1);
	}

	const frontmatterLines = frontmatterText.split("\n");
	const frontmatterKeys = new Set<string>();

	for (const line of frontmatterLines) {
		const keyMatch = line.match(/^([a-z_]+):/);
		if (keyMatch?.[1]) {
			frontmatterKeys.add(keyMatch[1]);
		}
	}

	// Validate required frontmatter keys
	const missingKeys = REQUIRED_FRONTMATTER_KEYS.filter((key) => !frontmatterKeys.has(key));
	if (missingKeys.length > 0) {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error(`Missing required frontmatter keys: ${missingKeys.join(", ")}`);
		process.exit(1);
	}

	// Extract H2 sections
	const h2Regex = /^## (.+)$/gm;
	const h2Sections: string[] = [];
	let match: RegExpExecArray | null = h2Regex.exec(content);

	while (match !== null) {
		if (match[1]) {
			h2Sections.push(match[1].trim());
		}
		match = h2Regex.exec(content);
	}

	// Validate required H2 sections
	const missingSections = REQUIRED_H2_SECTIONS.filter((section) => !h2Sections.includes(section));
	if (missingSections.length > 0) {
		// biome-ignore lint/suspicious/noConsole: CLI script requires stderr output
		console.error(`Missing required H2 sections: ${missingSections.join(", ")}`);
		process.exit(1);
	}

	// All checks passed
	process.exit(0);
}

main();
