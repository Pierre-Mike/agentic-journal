// @no-test: smoke gate, not unit tested

/**
 * Gate for spec 047-morning-digest.
 *
 * Creates a synthetic fixture with:
 *   - 1 archived spec (MERGED, last 24h)
 *   - 1 active spec with ci-failure.md (PAUSED)
 *   - 1 needs-human mailbox (NEEDS-HUMAN)
 *
 * Runs morning-digest.ts against the fixture root and asserts:
 *   - "1 MERGED"
 *   - "1 PAUSED"
 *   - "1 NEEDS-HUMAN"
 *
 * Cleanup after test.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function main(): void {
	const repoRoot = process.cwd();
	const fixtureRoot = join(repoRoot, ".agentic", "tmp-digest-fixture");

	// Cleanup if exists
	if (existsSync(fixtureRoot)) {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}

	// Create fixture directories
	mkdirSync(fixtureRoot, { recursive: true });

	const archiveDir = join(fixtureRoot, "specs", "archive");
	const activeDir = join(fixtureRoot, "specs", "active");
	const agenticDir = join(fixtureRoot, ".agentic");

	mkdirSync(archiveDir, { recursive: true });
	mkdirSync(activeDir, { recursive: true });
	mkdirSync(agenticDir, { recursive: true });

	// Create 1 archived spec (last 24h)
	const today = new Date().toISOString().split("T")[0] ?? "unknown";
	const archivedSpecDir = join(archiveDir, `${today}-fake1-test`);
	mkdirSync(archivedSpecDir, { recursive: true });

	const proposalPath = join(archivedSpecDir, "proposal.md");
	writeFileSync(
		proposalPath,
		`---
id: fake1-test
title: Test archived spec
created: ${today}
---

## Intent
Test archived spec for morning digest.
`,
		"utf-8",
	);

	// Create 1 active spec with ci-failure.md
	const activeSpecDir = join(activeDir, "fake2-test");
	mkdirSync(activeSpecDir, { recursive: true });

	const ciFailurePath = join(activeSpecDir, "ci-failure.md");
	writeFileSync(ciFailurePath, "# CI Failure\n\nTest failure for morning digest.\n", "utf-8");

	// Create needs-human mailbox
	const mailboxPath = join(agenticDir, "last-alignment.md");
	writeFileSync(
		mailboxPath,
		`---
created: ${today}
status: needs-human
confidence: low
intent_hash: deadbeef
---

## Goal

Test needs-human intent for morning digest.

## Big Picture

This is a test mailbox entry.

## Straightforward Details

Test details.

## Non-obvious Decisions

No decisions.
`,
		"utf-8",
	);

	// Run morning-digest.ts against fixture root
	let output: string;
	try {
		output = execSync(`bun ${join(repoRoot, "scripts", "morning-digest.ts")} ${fixtureRoot}`, {
			encoding: "utf-8",
			cwd: repoRoot,
		});
	} catch (error: unknown) {
		if (error instanceof Error && "stdout" in error) {
			output = (error as { stdout: Buffer }).stdout.toString();
		} else {
			throw error;
		}
	}

	// Assert digest contains expected counts
	const expectedPatterns = [
		/MERGED \(1\)/,
		/PAUSED \(1\)/,
		/NEEDS-HUMAN \(1\)/,
		/fake1-test/,
		/CI red/,
		/Test needs-human intent/,
	];

	let failed = false;
	for (const pattern of expectedPatterns) {
		if (!pattern.test(output)) {
			process.stderr.write(`✖ Expected pattern not found: ${pattern}\n`);
			failed = true;
		}
	}

	// Cleanup
	rmSync(fixtureRoot, { recursive: true, force: true });

	if (failed) {
		process.stderr.write("\nActual output:\n");
		process.stderr.write(output);
		process.exit(1);
	}

	process.stdout.write("✓ smoke-morning-digest passed\n");
}

main();
