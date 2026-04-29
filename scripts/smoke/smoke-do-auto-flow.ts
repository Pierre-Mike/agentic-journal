// @no-test: gate script for spec 046, validates /do-auto confidence branching

/**
 * Gate: smoke test the /do-auto confidence branching logic.
 *
 * Validates that:
 * 1. High-confidence alignment.md → branching helper returns {proceed: true}
 * 2. Low-confidence alignment.md with status:needs-human → helper returns {proceed: false, reason}
 *
 * This gate validates the WIRING only. It does NOT invoke subagents or run /do-auto end-to-end.
 * We test the branching helper in isolation to ensure /do-auto reads the mailbox status correctly.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseAlignmentAndBranch } from "../agentic/do-auto-branch";

function main() {
	const tmpDir = join(process.cwd(), ".agentic/tmp-gate-046");
	if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
	mkdirSync(tmpDir, { recursive: true });

	let passed = 0;
	let failed = 0;

	// Test case 1: high confidence → proceed
	{
		const fixturePath = join(tmpDir, "high-confidence.md");
		const fixture = `---
created: 2026-04-28T00:00:00Z
status: confirmed
confidence: high
intent_hash: abc123
---

## Goal
Implement feature X.

## Big Picture
...

## Straightforward Details
...

## Non-obvious Decisions
...
`;
		writeFileSync(fixturePath, fixture, "utf-8");
		const result = parseAlignmentAndBranch(fixturePath);

		if (result.proceed === true) {
			// biome-ignore lint/suspicious/noConsole: gate script requires stdout
			console.log("✓ Test 1: high confidence → proceed");
			passed++;
		} else {
			// biome-ignore lint/suspicious/noConsole: gate script requires stderr
			console.error(`✗ Test 1 FAILED: expected {proceed: true}, got ${JSON.stringify(result)}`);
			failed++;
		}
	}

	// Test case 2: low confidence + needs-human → exit cleanly
	{
		const fixturePath = join(tmpDir, "low-confidence.md");
		const fixture = `---
created: 2026-04-28T00:00:00Z
status: needs-human
confidence: low
intent_hash: def456
---

## Goal
Ambiguous request that requires clarification.

## Big Picture
...

## Straightforward Details
...

## Non-obvious Decisions
...
`;
		writeFileSync(fixturePath, fixture, "utf-8");
		const result = parseAlignmentAndBranch(fixturePath);

		if (result.proceed === false && result.reason !== undefined && result.reason.length > 0) {
			// biome-ignore lint/suspicious/noConsole: gate script requires stdout
			console.log("✓ Test 2: low confidence → exit with reason");
			passed++;
		} else {
			// biome-ignore lint/suspicious/noConsole: gate script requires stderr
			console.error(
				`✗ Test 2 FAILED: expected {proceed: false, reason: <string>}, got ${JSON.stringify(result)}`,
			);
			failed++;
		}
	}

	// Cleanup
	rmSync(tmpDir, { recursive: true });

	// biome-ignore lint/suspicious/noConsole: gate script requires stdout
	console.log(`\nGate: ${passed} passed, ${failed} failed`);
	process.exit(failed > 0 ? 1 : 0);
}

main();
